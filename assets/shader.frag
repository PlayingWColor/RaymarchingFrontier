#version 330 core
out vec4 FragColor;
  
in vec2 screenUV; // the input variable from the vertex shader (same name and same type)  

varying vec3 rayOrigin;

uniform vec2 viewportSize;
uniform vec4 time;

const float MAX_MARCH_DIS = 100.0;
const int MAX_MARCH_STEPS = 64;
const int CLOUD_RESOLUTION = 64;

#define PI 3.1415927
#define M1 15973346     //1719413*929
#define M2 38120158     //140473*2467*11

//#define RENDER_VOLUME

struct SurfaceData
{
	float dis;
	vec3 col;
	float emit;
	float shine;
	float metal;
};

struct VolumeData
{
	vec4 col;
	float density;
	float absorb;
};
//HUEtoRGB by chilli ant - https://www.chilliant.com/rgb2hsv.html
vec3 HUEtoRGB(in float H)
{
    float R = abs(H * 6 - 3) - 1;
    float G = 2 - abs(H * 6 - 2);
    float B = 2 - abs(H * 6 - 4);
    return clamp(vec3(R,G,B),0.0,1.0);
}

//modified noise, original from : https://www.shadertoy.com/view/4dS3Wd
float hash(float p) { p = fract(p * 0.011); p *= p + 7.5; p *= p + p; return fract(p); }
float noise( in vec3 x )
{
    const vec3 step = vec3(110, 241, 171);

    vec3 i = floor(x);
    vec3 f = fract(x);
 
    // For performance, compute the base input to a 1D hash from the integer part of the argument and the 
    // incremental change to the 1D based on the 3D -> 1D wrapping
    float n = dot(i, step);

    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix( hash(n + dot(step, vec3(0, 0, 0))), hash(n + dot(step, vec3(1, 0, 0))), u.x),
                   mix( hash(n + dot(step, vec3(0, 1, 0))), hash(n + dot(step, vec3(1, 1, 0))), u.x), u.y),
               mix(mix( hash(n + dot(step, vec3(0, 0, 1))), hash(n + dot(step, vec3(1, 0, 1))), u.x),
                   mix( hash(n + dot(step, vec3(0, 1, 1))), hash(n + dot(step, vec3(1, 1, 1))), u.x), u.y), u.z);
}

vec3 noise3D(in vec3 x)
{
    const vec3 step = vec3(110, 241, 171);

    vec3 i = floor(x);
    vec3 f = fract(x);
 
    // For performance, compute the base input to a 1D hash from the integer part of the argument and the 
    // incremental change to the 1D based on the 3D -> 1D wrapping
    float n = dot(i, step);

    vec3 u = f * f * (3.0 - 2.0 * f);
    return  vec3( mix(hash(n + dot(step, vec3(0, 0, 0))), hash(n + dot(step, vec3(1, 1, 1))), u.x),
                   mix( hash(n + dot(step, vec3(0, 1, 0))), hash(n + dot(step, vec3(1, 0, 1))), u.y),
               		mix( hash(n + dot(step, vec3(0, 0, 1))), hash(n + dot(step, vec3(1, 1, 0))), u.z));
}

float cloud(in vec3 x)
{
	return noise(x) * 0.5 + noise(x * 2.0) * 0.25 + noise(x * 4.0) * 0.125 + noise(x * 8.0) * 0.0625;
}

float sCurve(float t)
{
	return (-cos(PI*t) + 1) * 0.5f;
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
//sphere by Inigo Quilez
float sphere(in vec3 position, in float radius)
{
	return length(position) - radius;
}
//cube by Inigo Quilez
float cube(in vec3 position, in vec3 bounds)
{
    vec3 d = abs(position) - bounds;
    return min(max(d.x,max(d.y,d.z)),0.0) + length(max(d,0.0));
}
//cube by Inigo Quilez
float octahedron( vec3 position, float size)
{
  position = abs(position);
  return (position.x+position.y+position.z-size)*0.57735027;
}
float infinitePlane(vec3 position, float height)
{
	return position.y - height;
}
SurfaceData Part0AlienOrb(in vec3 rayPos)
{
	vec3 pos = vec3(0.0,-0.5,-20.0 + time.z);
	
	//float displacement = cloud(vec3(rayPos * 2.0 + time.w * 1.0))*1.0 + sin(rayPos.y * 20.0 - time.w * 10.0) * 0.5;
	float displacement = cloud(vec3(rayPos.x + time.x * 0.2, rayPos.y + time.x * 0.5, rayPos.z + time.x * 1.0));//sin(rayPos.y * 5.0 + time.z);

	SurfaceData result;

	result.dis = sphere(pos + rayPos, 0.5) + displacement * 0.55;
	result.col = vec3(0.2,0.7,0.8);
	result.emit = clamp(-0.2 + displacement,0.5,1.0);
	result.shine = 0.8;
	result.metal = 0.0;

	return result;
}
vec3 dancingOctahedron(vec3 rayPos, float timeOffset)
{
	float timeYOffset = time.y + timeOffset;
	float timeZOffset = time.z + timeOffset;

	vec3 pos0 = vec3(5.0, 1.0, 2.0);
	vec3 pos1 = vec3(sin(timeYOffset) * 2.0, cos(timeYOffset), 2.0);
	vec3 pos2 = vec3(sin((timeZOffset) * 2) * 0.25, 0.0, cos((timeZOffset) * 2) * 0.25);
	vec3 pos3 = vec3(-5.0, -1.0, 2.0);

	vec3 trans1 = mix(pos0, pos1, sCurve(clamp(timeYOffset * 0.5,0.0,1.0)));
	vec3 trans2 = mix(trans1, pos1 + pos2, sCurve(clamp(timeYOffset - 10.0,0.0,1.0)));
	vec3 trans3 = mix(trans2, pos3, sCurve(clamp(timeYOffset * 0.5 - 10.0,0.0,1.0)));

	vec3 scaleRayPos = (rayPos - trans3) * vec3(1.0,0.5,1.0); 

	vec3 rotRayPos = rotateY(scaleRayPos, timeYOffset, vec3(0.0));

	return rotRayPos;
}
SurfaceData Part1DancingOctohedrons(in vec3 rayPos, in float timeOffset)
{
	vec3 rotRayPos0 = dancingOctahedron(rayPos, -timeOffset + 0.0);
	vec3 rotRayPos1 = dancingOctahedron(rayPos, -timeOffset - 1.5);
	vec3 rotRayPos2 = dancingOctahedron(rayPos, -timeOffset - 3.0);
	vec3 rotRayPos3 = dancingOctahedron(rayPos, -timeOffset - 4.5);
	
	SurfaceData result;
	SurfaceData result1;
	SurfaceData result2;
	SurfaceData result3;

	result.dis = octahedron(rotRayPos0, 0.125);
	result.col = vec3(0.9,0.1,0.1);
	
	result1.dis = octahedron(rotRayPos1, 0.125);
	result1.col = vec3(0.1,0.9,0.1);

	result2.dis = octahedron(rotRayPos2, 0.125);
	result2.col = vec3(0.1,0.1,0.9);

	result3.dis = octahedron(rotRayPos3, 0.125);
	result3.col = vec3(0.9,0.9,0.9);

	result = closest(result, result1);
	result = closest(result, result2);
	result = closest(result, result3);

	result.emit = 0.3;
	result.shine = 0.98;
	result.metal = 1.0;

	return result;
}
SurfaceData Part2Kaleidoscope(in vec3 rayPos, in float timeOffset)
{
	SurfaceData result;
	const float endTime = 20;	
	float endTrans = clamp((time.y-timeOffset-endTime)*0.00025,0.0,1.0);

	const vec3 spacing = vec3(1.5, 1.5, 0.1);

	vec3 rayPos1 = rayPos + vec3(-1.25,-0.75,-(time.w-timeOffset * 3.0) * 10 - 0.75);
	
	rayPos1 = rotateZ(rayPos1, rayPos1.z * 0.025, vec3(0.0,0.0,rayPos1.z));

	vec3 offsetPos = rayPos1 + vec3(2.0,2.0,2.0);

	vec3 cubes = round(offsetPos/spacing);
	cubes.z = mix(min(cubes.z,0.0),max(cubes.z,-endTime * 3.0 * 10 - 500), endTrans);
	cubes = offsetPos - spacing * cubes;
	//cubes = rotateZ(cubes, rayPos1.z, vec3(0.0, 0.0, rayPos1.z));

	result.dis = cube(cubes, vec3(0.1));
	result.col = vec3(0.1,0.1,0.1);// % 1;
	
	SurfaceData result1;

	vec3 rayPos2 = rayPos + vec3(1.25,0.75,-(time.w-timeOffset * 3.0) * 10 + 0.75);
	
	rayPos2 = rotateZ(rayPos2, rayPos2.z * -0.025, vec3(0.0,0.0,rayPos2.z));

	vec3 offsetPos2 = rayPos2 + vec3(2.0,2.0,2.0);

	vec3 cubes2 = round(offsetPos2/spacing);
	cubes2.z = mix(min(cubes2.z,0.0),max(cubes.z,-endTime * 3.0 * 10 - 100), endTrans);
	cubes2 = offsetPos2 - spacing * cubes2;

	result1.dis = cube(cubes2, vec3(0.1));

	float rainBowTrans = clamp((time.y-timeOffset-10),0.0,1.0);

	result1.col = mix(vec3(0.8),HUEtoRGB(mod(rayPos2.z*0.1,1.0)) + vec3(0.25),rainBowTrans);

	result = closest(result, result1);

	result.emit = mix(0.4,1.5,rainBowTrans);
	result.shine = 0.1;
	result.metal = 0.0;

	return result;
}

float waveDisplacement(vec2 pos, vec2 dir, float freq, float t)
{
	return exp(sin(dot(dir,pos) * freq + t))-1.5;
}
SurfaceData Part3CubeOcean(in vec3 rayPos, in float timeOffset)
{
	SurfaceData result;
	
	vec3 offsetPos = rayPos + vec3(0.0,max(8.0,(-time.y+timeOffset)*4.0 + 68.0),time.w*3);

	offsetPos.y = offsetPos.y - max(0.0,(time.y-timeOffset-25.0)*4.0);

	float ylimit = 1.0;
	vec3 spacing = vec3(2.0);
	
	vec3 cubesID = round(offsetPos/spacing);
	vec3 cubesOff = sign(offsetPos - spacing * cubesID);
	result.dis = MAX_MARCH_DIS;
	if(rayPos.y > time.y)
		return result;

	for(int i=0; i<2; i++)
	for(int j=0; j<2; j++)
	for(int k=0; k<2; k++)
	{
		vec3 cubesRID = cubesID + vec3(i,j,k)*cubesOff;
		cubesRID.y = clamp(cubesRID.y, -ylimit,ylimit);
		vec3 cubes = offsetPos - spacing * cubesRID;	
		vec3 gridPos3D = round(cubesRID);
		vec2 gridPos = gridPos3D.xz;
		vec3 color = noise3D(vec3(gridPos+vec2(0.25),1.0));

		float displacement = waveDisplacement(gridPos, vec2(0.4,0.6), 0.2, time.w)*0.025;
		displacement += waveDisplacement(gridPos, vec2(0.1,-0.9), 1.2, time.w)*0.05;
		displacement += waveDisplacement(gridPos, vec2(0.672,0.238), 1.8, time.w)*0.1;
		displacement += waveDisplacement(gridPos, vec2(-0.81,0.19), 2.7, time.w)*0.2;
		displacement += waveDisplacement(gridPos, vec2(0.45,-0.55), 3.4, time.w)*0.12;	
		displacement += waveDisplacement(gridPos, vec2(0.3,-0.7), 6.0, time.w)*0.03;	
		displacement += waveDisplacement(gridPos, vec2(-0.15,-0.85), 7.0, time.w)*0.02;	
		displacement += waveDisplacement(gridPos, vec2(0.95,-0.05), 8.0, time.w)*0.04;	

		vec3 halfColor = color - vec3(0.5);

		cubes.y -= displacement * 2.0;
		cubes = rotateX(cubes, (halfColor.x) * (0.5 + time.x * halfColor.y), vec3(0.0));
		cubes = rotateY(cubes, (halfColor.y) * (0.5 + time.x * halfColor.z), vec3(0.0));
		cubes = rotateZ(cubes, (halfColor.z) * (0.5 + time.x * halfColor.x), vec3(0.0));


		float newDis = cube(cubes, vec3(0.8));
		if(newDis < result.dis)
		{
			result.dis = newDis;
			result.col = color;
		}
	}
	result.emit = 0.0;
	result.shine = 0.5;
	result.metal = 0.0;
	
	return result;

	//bad ocean color = vec3(0.2,0.5,0.75);

}
SurfaceData Part4TrippyEffects(in vec3 rayPos, float timeOffset)
{
	SurfaceData result;

	vec3 tripRayPos = mix(rayPos,vec3(sin(rayPos.x),sin(rayPos.y),1.0),clamp((time.y-timeOffset-10)*0.01,0.0,1.0));

	float displacement = cloud(vec3(tripRayPos.x + time.x * 2.2, tripRayPos.y + time.x * 5.5, tripRayPos.z + time.x * 10.0));//sin(tripRayPos.y * 5.0 + time.z);
	float displacement1 = sin(tripRayPos.y * 5.0 + time.y) * 0.5 - cos(tripRayPos.x * 12.5 + time.y * 1.4) * 0.25 + displacement * 0.5;
	float displacement2 = sin(tripRayPos.x*0.13 * time.w) + sin(tripRayPos.y*0.4 * time.z) + sin(tripRayPos.z*0.2 * time.y);

	float clouds = cloud(tripRayPos);
	
	float cloudsExp = min(2*pow(clouds,3.0),1.0);

	result.dis = cube(tripRayPos - vec3(0.0,0.0,10.0),vec3(14.0,8.0,1.0)) - displacement * 3.0;
	result.col = mix(vec3(0.1),vec3(0.9),cloudsExp);
	result.emit = cloudsExp;
	result.shine = 0.0;
	result.metal = 0.0;
	
	SurfaceData result1;
	
	result1.dis = cube(tripRayPos - vec3(0.0,0.0,15.0), vec3(14.0,8.0,1.0)) - displacement1 * 10.0;
	result1.col = mix(HUEtoRGB(mod((time.y+tripRayPos.x)*0.01,1.0))+0.5,HUEtoRGB(mod((time.y+tripRayPos.x)*0.01,1.0))+0.5,cloudsExp + sin(tripRayPos.x) * 0.1) * 1.0;
	result1.emit = 0.5;
	result1.shine = 0.0;
	result1.metal = 0.0;
	
	SurfaceData result2;

	result2.dis = cube(tripRayPos - vec3(0.0,0.0,20.0 - sin(time.x - timeOffset*0.05)*25), vec3(14.0,8.0,1.0)) - displacement2;
	result2.col = mix(vec3(0.1,0.4,0.8),vec3(0.8,0.4,0.1),tripRayPos.z*0.6) * 2.0;
	result2.emit = 0.3;
	result2.shine = 0.0;
	result2.metal = 0.0;

	return closest(closest(result,result1),result2);
}
SurfaceData surfaceComposite(in vec3 rayPos)
{
	SurfaceData result = Part0AlienOrb(rayPos); 
	if(time.y > 12.0 && time.y < 47.0)
		result = closest(result, Part1DancingOctohedrons(rayPos, 12.0));
	if(time.y > 38.0 && time.y < 80.0)
		result = closest(result, Part2Kaleidoscope(rayPos, 43.0));
	if(time.y > 70.0 && time.y < 110.0)
		result = closest(result, Part3CubeOcean(rayPos, 75.0));
	if(time.y >	102.0)
		result = closest(result, Part4TrippyEffects(rayPos, 102.0));
	return result;
}
VolumeData skyClouds(in vec3 rayPos)
{
	VolumeData result;
	
	vec3 offsetPos = rayPos + vec3(0.0,max(-18.0,(-time.y+75.0)*4.0 + 40.0),0.0);

	result.density = clamp((cloud(offsetPos*0.2)-0.35),0.0,1.0) * 0.2 * clamp(pow(offsetPos.y-10.0,3),0.0,1.0) * clamp(pow(41.0-offsetPos.y, 3) * 0.01,0.0,1.0);
	result.density = mix(result.density,0.0,clamp(-time.y+75.0,0.0,1.0));
	result.col = vec4(vec3(0.95),1.0) * (cloud(offsetPos)*0.5 + 0.5);
	result.absorb = 0.004;

	return result;
}
VolumeData rainbowClouds(in vec3 rayPos)
{
	VolumeData result;
	
	vec3 offsetPos = rayPos + vec3(0.0,-4.0,0.0);

	result.density = 1.0 * clamp(pow(offsetPos.y-5.0,3),0.0,1.0) * clamp(pow(7.0-offsetPos.y,3),0.0,1.0);

	result.col = vec4(HUEtoRGB(cloud(vec3(offsetPos.xz,0.0))),1.0);

	return result;
}
VolumeData volumeComposite(in vec3 rayPos)
{
	VolumeData result = skyClouds(rayPos);

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
vec3 world0space(in vec3 skyPos)
{
	skyPos = rotateZ(skyPos, time.x, vec3(0));

	vec3 background = mix(vec3(0.0,0.0025,0.1),vec3(0.0025),clamp(skyPos.y*10.0+2.0,0.0,1.0));
	
	float cloudT = cloud(skyPos - 2.3);

	vec3 clouds = mix(vec3(0.89,0.275,0.055),vec3(0.988,0.494,0.788),cloudT);
	clouds = mix(vec3(0,0,0), clouds, cloudT - 0.4) * 5.0;
	
	float stars = clamp(cloud(skyPos * 100) - 0.7,0.0,1.0) * 10; 

	vec3 colorStars = stars * 0.5 + stars * abs(skyPos);

	return max(background + clouds + stars,0.0); 
}
vec3 world1kaleidoscope(in vec3 skyPos)
{
	vec3 background = mix(vec3(0.9,0.25,0.1),vec3(0.1,0.6,0.1),clamp(skyPos.y*10.0+2.0,0.0,1.0));
	return background;
}

vec3 world2sky(in vec3 skyPos)
{
	vec3 background = mix(vec3(0.475,0.745,0.949),vec3(0.475,0.745,0.949),clamp(skyPos.y*10.0+2.0,0.0,1.0));
	background = mix(background, vec3(0.375,0.375,0.778),clamp(skyPos.y - 0.0, 0.0, 1.0));

	return background;
}
vec3 worldComposite(in vec3 skyPos)
{
	float firstTrans = clamp(time.y-70-skyPos.y,0.0,1.0);
	float secondTrans = clamp(time.y-102,0.0,1.0);

	return mix(mix(world0space(skyPos),world2sky(skyPos-vec3(0.0,firstTrans-1.0,0.0)), firstTrans),vec3(0.0),secondTrans);
}
void main()
{
    float aspect = viewportSize.x / viewportSize.y;

    vec2 scaledUV = vec2((screenUV.x - 0.5) * aspect, screenUV.y - 0.5) * 2.0; 

    vec3 rayOrigin = vec3(0.0,0.0,0.0);
    vec3 rayDir = normalize(vec3(scaledUV,1.0));
  	//rayDir = rotateX(rayDir, 0.7, rayOrigin);


    SurfaceData totalResult;
    totalResult.dis = 0.0;

    SurfaceData reflectResult;
    reflectResult.dis = 0.0;
    //directional light
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

#ifdef RENDER_VOLUME

	VolumeData volumeResult;
	volumeResult.col = vec4(0.0);
	volumeResult.density = 0.0;
	volumeResult.absorb = 0.0;
	const float volumeStep = 0.5;
	int stepCount = 0;
    //volumes
    for(float vDis = 0.0; vDis < totalResult.dis; vDis += volumeStep)
    {
        vec3 rayPos = rayOrigin + rayDir * vDis;

        VolumeData result = volumeComposite(rayPos);
        volumeResult.density += result.density * volumeStep;
        volumeResult.absorb += result.absorb * volumeStep;
		volumeResult.col += result.col;

		stepCount++;
    }
	volumeResult.col /= stepCount;
	volumeResult.col.a *= volumeResult.density;

#endif
    
	vec3 rayPos = rayOrigin + rayDir * totalResult.dis;
    vec3 normal = calcNormal(rayPos);
    vec3 reflectRayDir = reflect(rayDir, normal);
    vec3 reflectRayOrigin = rayPos + reflectRayDir * totalResult.dis;
	
	float totalRough = 1.0 - totalResult.shine;

    vec3 worldReflect = vec3(0);
  	
	for(int i = 0; i < 32; i++)
	{
		worldReflect += worldComposite(mix(reflectRayDir,noise3D(reflectRayDir * (1000 + i * 11)), totalRough * 0.5)); 
	}
	worldReflect = worldReflect / 32.0;

	const vec3 sun = vec3(0.5,0.8,-0.7);

	if (totalResult.dis >= MAX_MARCH_DIS)
    {
        FragColor = vec4(worldComposite(rayDir), 1.0); 
    }
    else
    {
        vec3 rayPos = rayOrigin + rayDir * totalResult.dis;
		vec3 normal = calcNormal(rayPos);


		float lambert = clamp(dot(normal, sun),0.0,1.0);

		vec3 halfDir = normalize(sun - rayDir);

		float specular = pow(clamp(dot(normal, halfDir),0.0,1.0),totalResult.shine * 16.0) * totalResult.shine * 4.0;
		specular *= lambert;

		reflectResult.col = reflectResult.dis >= MAX_MARCH_DIS ?  worldReflect : reflectResult.col;

		vec3 reflectCol = reflectResult.col;// * totalResult.shine;

		FragColor = vec4(vec3(totalResult.col) * 
                (totalResult.emit + specular + reflectCol + lambert * (1.0-totalResult.metal) + 
                 vec3(0.01,0.01,0.01)) + clamp(reflectCol - 0.75,0.0,1.0),1.0);
	}
#ifdef RENDER_VOLUME
	//apply volume to FragColor
	{
		//vec3 normal = rayDir;
		//float lambert = clamp(dot(normal, sun), 0.0,1.0);
		vec3 fakeIndirect = world2sky(vec3(0.0,1.0,0.0));
		//vec3 subsurface = clamp(vec3(dot(-normal, sun)) - vec3(volumeResult.absorb), vec3(0.0),vec3(1.0));

		FragColor = mix(FragColor, vec4(mix(volumeResult.col.rgb + fakeIndirect,vec3(0.0,0.2,0.4),clamp(volumeResult.absorb,0.0,1.0)),1.0), clamp(volumeResult.col.a,0.0,1.0));
	}
#endif
	//fade to and from black
	{
		FragColor = mix(vec4(vec3(0.0),1.0), FragColor, sCurve(clamp((time.y-2.0)*0.4,0.0,1.0)));
	}
} 
