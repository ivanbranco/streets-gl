import Pass, {InternalResourceType} from "./Pass";
import Resource from "./Resource";
import Node from "./Node";
import {Queue} from "./Utils";
import ResourcePool from "./PhysicalResourcePool";

export default class RenderGraph {
	public passes: Set<Pass> = new Set();
	private resourcePool: ResourcePool = new ResourcePool();

	public addPass(pass: Pass) {
		this.passes.add(pass);
	}

	private sortRenderableNodes(nodes: Set<Node>): Node[] {
		// Kahn's algorithm

		const queue = new Queue<Node>();

		for (const node of nodes) {
			if (node.tempIndegreeSet.size === 0) {
				queue.push(node);
			}
		}

		let visitedCount = 0;
		const graphNodeCount = nodes.size;
		const topOrder: Node[] = [];

		while (!queue.isEmpty()) {
			const node = queue.pop();

			if (node.isRenderable) {
				topOrder.push(node);
			}

			for (const adjacentNode of node.tempOutdegreeSet) {
				adjacentNode.tempIndegreeSet.delete(node);

				if (adjacentNode.tempIndegreeSet.size === 0) {
					queue.push(adjacentNode);
				}
			}

			++visitedCount;
		}

		if (visitedCount !== graphNodeCount) {
			throw new Error('Render graph has a cycle');
		}

		return topOrder;
	}

	private getResourcesUsedExternally(passes: Set<Pass>): Set<Resource> {
		const result: Set<Resource> = new Set();

		for (const pass of passes) {
			const resources = pass.getOutputResourcesUsedExternally();

			for (const resource of resources) {
				result.add(resource);
			}
		}

		return result;
	}

	private buildGraphWithCulling(passes: Set<Pass>): Set<Node> {
		const nodes: Node[] = Array.from(this.getResourcesUsedExternally(passes));
		const graph: Set<Node> = new Set();

		for (const node of nodes) {
			node.tempIndegreeSet.clear();
			node.tempOutdegreeSet.clear();

			graph.add(node);
		}

		while (nodes.length > 0) {
			const node = nodes.shift();

			for (const prevNode of node.previousNodes) {
				if (!graph.has(prevNode)) {
					prevNode.tempIndegreeSet.clear();
					prevNode.tempOutdegreeSet.clear();

					graph.add(prevNode);
					nodes.push(prevNode);
				}

				node.tempIndegreeSet.add(prevNode);

				prevNode.tempOutdegreeSet.add(node);
			}
		}

		return graph;
	}

	public updateAllNodesVertices() {
		const allResources: Set<Resource<any, any>> = new Set();

		for (const pass of this.passes) {
			const inputResources = pass.getAllResourcesOfType(InternalResourceType.Input);
			const outputResources = pass.getAllResourcesOfType(InternalResourceType.Output);

			pass.previousNodes = inputResources;
			pass.nextNodes = outputResources;

			for (const resource of [...inputResources, ...outputResources]) {
				allResources.add(resource);
			}
		}

		for (const resource of allResources) {
			resource.nextNodes.clear();
			resource.previousNodes.clear();
		}

		for (const pass of this.passes) {
			for (const resource of pass.previousNodes) {
				resource.nextNodes.add(pass);
			}

			for (const resource of pass.nextNodes) {
				resource.previousNodes.add(pass);
			}
		}
	}

	public render() {
		this.updateAllNodesVertices();

		const graph = this.buildGraphWithCulling(this.passes);
		const sorted = <Pass[]>this.sortRenderableNodes(graph);

		for (const pass of sorted) {
			pass.fetchPhysicalResources(this.resourcePool);
			pass.render();
		}

		for (const pass of sorted) {
			pass.freePhysicalResources(this.resourcePool);
		}

		this.resourcePool.update();
	}
}