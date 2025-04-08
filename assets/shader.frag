#version 330 core
out vec4 FragColor;
  
in vec2 screenUV; // the input variable from the vertex shader (same name and same type)  

varying vec3 rayOrigin;

uniform vec2 viewportSize;

const float MAX_MARCH_DIS = 25.0;
const int MAX_MARCH_STEPS = 128;
const int CLOUD_RESOLUTION = 64;

#define M1 1597334677     //1719413*929
#define M2 3812015801     //140473*2467*11
                          
struct SurfaceData
{
	float dis;
	vec3 col;
	float emit;
	float shine;
	float metal;
};

float hash(ivec3 q)
{
	q *= ivec3(M1, M2, M1);
    int n = q.x ^ q.y ^ q.z;
    n = n * (n ^ (n >> 15));
    return float(n) * (1.0/float(0xffffffff));
}

float noise( in vec3 x )
{
    ivec3 i = ivec3(floor(x));
    vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
	
    return mix(mix(mix( hash(i+ivec3(0,0,0)), 
                        hash(i+ivec3(1,0,0)),f.x),
                   mix( hash(i+ivec3(0,1,0)), 
                        hash(i+ivec3(1,1,0)),f.x),f.y),
               mix(mix( hash(i+ivec3(0,0,1)), 
                        hash(i+ivec3(1,0,1)),f.x),
                   mix( hash(i+ivec3(0,1,1)), 
                        hash(i+ivec3(1,1,1)),f.x),f.y),f.z);
}

float cloud(in vec3 x)
{
	return noise(x) + noise(x * 2.0) * 0.5 + noise(x * 4.0) * 0.25 + noise(x * 8.0) * 0.125;
}

vec3 rotateX(vec3 inPos, float amount, vec3 center)
{
	inPos.y -= center.y;
	inPos.z -= center.z;
	float originalY = inPos.y;
	float originalZ = inPos.z;
	inPos.y = originalY*cos(amount)-originalZ*sin(amount);
	inPos.z = originalZ*cos(amount)+originalY*sin(amount);
	inPos.y += center.y;
	inPos.z += center.z;
	return inPos;
}

vec3 rotateY(vec3 inPos, float amount, vec3 center)
{
	inPos.x -= center.x;
	inPos.z -= center.z;
	float originalX = inPos.x;
	float originalZ = inPos.z;
	inPos.x = originalX*cos(amount)-originalZ*sin(amount);
	inPos.z = originalZ*cos(amount)+originalX*sin(amount);
	inPos.x += center.x;
	inPos.z += center.z;
	return inPos;
}

vec3 rotateZ(vec3 inPos, float amount, vec3 center)
{
	inPos.x -= center.x;
	inPos.y -= center.y;
	float originalX = inPos.x;
	float originalY = inPos.y;
	inPos.x = originalX*cos(amount)-originalY*sin(amount);
	inPos.y = originalY*cos(amount)+originalX*sin(amount);
	inPos.x += center.x;
	inPos.y += center.y;
	return inPos;
}

SurfaceData closest(SurfaceData a, SurfaceData b)
{
	SurfaceData result = b;
	
	if(a.dis < b.dis)
		result = a;
	return result;
}

float sphere(in vec3 position, in float radius)
{
	return length(position) - radius;
}
float cube(in vec3 position, in vec3 bounds)
{
    vec3 d = abs(position) - bounds;
    return min(max(d.x,max(d.y,d.z)),0.0) + length(max(d,0.0));
}
float octahedron( vec3 position, float size)
{
  position = abs(position);
  return (position.x+position.y+position.z-size)*0.57735027;
}
SurfaceData surfaceComposite(in vec3 rayPos)
{
	SurfaceData result;
    result.dis = sphere(rayPos - vec3(0.0,0.0,1.0), 0.5);
	result.col = vec3(1.0,1.0,1.0);
    result.emit = 0.0;
    result.shine = 0.3;
    result.metal = 1.0;

	return result;
}

vec3 calcNormal(in vec3 position)
{
	const float offset = 0.001;
	float dis = surfaceComposite(position).dis;
	
	return normalize(
				vec3(
					surfaceComposite(position + vec3(offset,0,0)).dis - dis,
					surfaceComposite(position + vec3(0,offset,0)).dis - dis,
					surfaceComposite(position + vec3(0,0,offset)).dis - dis
					)
				);
}
void main()
{
    float aspect = viewportSize.x / viewportSize.y;

    vec2 scaledUV = vec2((screenUV.x - 0.5) * aspect, screenUV.y - 0.5) * 2.0; 

    vec3 rayOrigin = vec3(0.0,0.0,0.0);
    vec3 rayDir = normalize(vec3(scaledUV,1.0));
   
    SurfaceData totalResult;
    totalResult.dis = 0.0;

    SurfaceData reflectResult;
    reflectResult.dis = 0.0;
    
    for(int i = 0; i < MAX_MARCH_STEPS; i++)
    {
        vec3 rayPos = rayOrigin + rayDir * totalResult.dis;

        SurfaceData result = surfaceComposite(rayPos);
        totalResult.dis += result.dis;
        totalResult.col = result.col;
        totalResult.emit = result.emit;
        totalResult.shine = result.shine;
        totalResult.metal = result.metal;

        if(result.dis < 0.0001 || totalResult.dis > MAX_MARCH_DIS)
            break;
    }
        
    vec3 rayPos = rayOrigin + rayDir * totalResult.dis;
    vec3 normal = calcNormal(rayPos);
    vec3 reflectRayDir = reflect(rayDir, normal);
    vec3 reflectRayOrigin = rayPos + reflectRayDir * totalResult.dis;

    vec3 worldReflect = mix(vec3(0.0,0.0025,0.1),vec3(0.0025),clamp(reflectRayDir.y*10.0+2.0,0.0,1.0));
    if (totalResult.dis >= MAX_MARCH_DIS)
    {
        FragColor = vec4(mix(vec3(0.0,0.0025,0.1),vec3(0.0025),clamp(rayDir.y*10.0+2.0,0.0,1.0)),1.0);
    }
    else
    {
        vec3 rayPos = rayOrigin + rayDir * totalResult.dis;
		vec3 normal = calcNormal(rayPos);

		vec3 sun = vec3(0.5,0.8,-0.7);

		float lambert = clamp(dot(normal, sun),0.0,1.0);

		vec3 halfDir = normalize(sun - rayDir);

		float specular = pow(clamp(dot(normal, halfDir),0.0,1.0),totalResult.shine * 16.0) * totalResult.shine * 4.0;
		specular *= lambert;

		reflectResult.col = reflectResult.dis >= MAX_MARCH_DIS ?  worldReflect : reflectResult.col;

		vec3 reflectCol = reflectResult.col * totalResult.shine;

		FragColor = vec4(vec3(totalResult.col) * 
                (totalResult.emit + specular + reflectCol + lambert * (1.0-totalResult.metal) + 
                 vec3(0.01,0.01,0.01)) + clamp(reflectCol - 0.75,0.0,1.0),1.0);
	}
} 
