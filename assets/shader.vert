#version 330 core
layout (location = 0) in vec3 aPos; // the position variable has attribute position 0
  
out vec2 screenUV; // specify a color output to the fragment shader

void main()
{
    gl_Position = vec4(aPos, 1.0);
    screenUV = (aPos.xy + 1.0) * 0.5;
}
