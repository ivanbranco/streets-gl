#include <versionPrecision>

in vec3 position;

out vec3 vNormal;

uniform Uniforms {
    mat4 projectionMatrix;
    mat4 modelViewMatrix;
    mat4 modelViewMatrixPrev;
};

out vec4 vClipPos;
out vec4 vClipPosPrev;

void main() {
    vNormal = position;

    vec3 transformedPosition = position;
    vec4 cameraSpacePosition = modelViewMatrix * vec4(transformedPosition, 1.0);
    vec4 cameraSpacePositionPrev = modelViewMatrixPrev * vec4(transformedPosition, 1.0);

    vClipPos = projectionMatrix * cameraSpacePosition;
    vClipPosPrev = projectionMatrix * cameraSpacePositionPrev;

    gl_Position = vClipPos;
}