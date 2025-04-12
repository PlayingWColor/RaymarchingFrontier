#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <glad/gl.h>
#include <GLFW/glfw3.h>

#include <SDL3/SDL.h>

#define SCREEN_WIDTH 1920
#define SCREEN_HEIGHT 1080
#define PROGRAM_NAME "PwCRevision2025"

const char *musicFile = "../assets/music.wav";

bool loadMusic();

void beginPlayMusic();

void closeMusic();

void frameUpdateMusic();

void framebuffer_size_callback(GLFWwindow* window, int width, int height);

unsigned int loadShader(const char* vertexShader, const char* fragmentShader);

long int getFileSize(FILE *filePtr);

void inputCallback(GLFWwindow *window, int key, int scancode, int action, int mods);

GLFWwindow *ToggleFullScreen(GLFWwindow *window);

//single triangle mesh
/*
float vertices[] = {
	-0.5f, -0.5f, 0.0f,
	 0.5f, -0.5f, 0.0f,
	 0.0f,  0.5f, 0.0f
};
*/

//rectangle mesh
float vertices[] = {
	 1.0f,  1.0f, 0.0f,  // top right
	 1.0f, -1.0f, 0.0f,  // bottom right
	-1.0f, -1.0f, 0.0f,  // bottom left
	-1.0f,  1.0f, 0.0f   // top left 
};
unsigned int indices[] = {  
	0, 1, 3,   // first triangle
	1, 2, 3	// second triangle
}; 

const char *vertexShaderSource = "../assets/shader.vert";
const char *fragmentShaderSource = "../assets/shader.frag";

unsigned int shaderID = -1;
GLint viewportSizeLoc = -1;
GLint timeLoc = -1;

int main()
{
	//Initialize SDL: Audio Only
	if(SDL_Init(SDL_INIT_AUDIO) == false)
	{
		printf("Failed to Initialize SDL with Audio\r\n");
		return -1;
	}
	//Load Music
	if(loadMusic() == false)
	{
		return -1;
	}

	//initialize and make window
	glfwInit();
	glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
	glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
	glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
	
	GLFWwindow* window = glfwCreateWindow(SCREEN_WIDTH, SCREEN_HEIGHT, 
											PROGRAM_NAME, NULL, NULL);
	
	if (window == NULL)
	{
		printf("Failed to create GLFW window\r\n");
		glfwTerminate();
			return -1;
	}
	glfwMakeContextCurrent(window);
	
	if (!gladLoadGL((GLADloadfunc)glfwGetProcAddress))
	{
			printf("Failed to initialize GLAD\r\n");
			return -1;
	}   
	//set viewport size
	glViewport(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

	glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);

	glfwSetKeyCallback(window, inputCallback);

	shaderID = loadShader(vertexShaderSource,fragmentShaderSource);
	glUseProgram(shaderID);
	viewportSizeLoc = glGetUniformLocation(shaderID,"viewportSize");
	timeLoc = glGetUniformLocation(shaderID,"time");
	printf("viewportSizeLoc:%d\r\n",viewportSizeLoc);
	printf("shaderID:%d\r\n",shaderID);
	glUniform2f(viewportSizeLoc, SCREEN_WIDTH, SCREEN_HEIGHT);

	//mark shader program to be used for rendering
	unsigned int VAO;
	glGenVertexArrays(1, &VAO); 

	unsigned int VBO;
	glGenBuffers(1, &VBO);
	
	unsigned int EBO;
	glGenBuffers(1, &EBO);
	// ..:: Initialization code (done once (unless your object frequently changes)) :: ..
	// 1. bind Vertex Array Object
	glBindVertexArray(VAO);
	// 2. copy our vertices array in a buffer for OpenGL to use
	glBindBuffer(GL_ARRAY_BUFFER, VBO);
	glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
	// 3. copy our index array in a element buffer for OpenGL to use
	glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, EBO);
	glBufferData(GL_ELEMENT_ARRAY_BUFFER, sizeof(indices), indices, GL_STATIC_DRAW);
	// 4. then set our vertex attributes pointers
	glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
	glEnableVertexAttribArray(0);  

	glPolygonMode(GL_FRONT_AND_BACK, GL_FILL);
	
	beginPlayMusic();

	float timeArray[4] = {-1};
	int lastSecond = 0;
	int fps = 0;
	while(!glfwWindowShouldClose(window))
	{
		if(lastSecond > 5)
			frameUpdateMusic();
		//begin render

		//paint window color
		glClearColor(0.2f, 0.3f, 0.3f, 1.0f);
		glClear(GL_COLOR_BUFFER_BIT);

		// ..:: Drawing code (in render loop) :: ..
		// 4. draw the object
		glUseProgram(shaderID);
		glBindVertexArray(VAO);

		//set uniforms
		timeArray[1] = glfwGetTime();
		timeArray[0] = timeArray[1] * 0.05;
		timeArray[2] = timeArray[1] * 2.0;
		timeArray[3] = timeArray[1] * 3.0;
		glUniform4fv(timeLoc, 1, (float*)(&timeArray[0]));
		
		glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_INT, 0);
		glBindVertexArray(0);
			
		
		//display render to screen
		glfwSwapBuffers(window);
		glfwPollEvents(); 
		fps++;
		if(timeArray[1] > lastSecond + 1)
		{		
			lastSecond = timeArray[1];
			printf("Time : %i|",lastSecond);
			printf("FPS : %i\r\n",fps);
			fps = 0;
		}
	}
	
	glfwTerminate();

	return 0;
}

void framebuffer_size_callback(GLFWwindow* window, int width, int height)
{
	glViewport(0, 0, width, height);
	glUniform2f(viewportSizeLoc, width, height);
}

void inputCallback(GLFWwindow *window, int key, int scancode, int action, int mods)
{
	if(key == GLFW_KEY_ESCAPE){
		closeMusic();
		glfwSetWindowShouldClose(window, true);
	}
	if(key == GLFW_KEY_F11 && action == GLFW_PRESS)
		ToggleFullScreen(window);
}

int windowedWidth = 0;
int windowedHeight = 0;
int windowedXPos = 0;
int windowedYPos = 0;
GLFWwindow* ToggleFullScreen(GLFWwindow *window)
{
	if(window == NULL)
	{
		printf("GLFW window does not exist!\r\n");
		return NULL;
	}
	GLFWmonitor* windowMonitor = glfwGetWindowMonitor(window);
	
	GLFWmonitor* primaryMonitor = glfwGetPrimaryMonitor();
	const GLFWvidmode *vidmode = glfwGetVideoMode(primaryMonitor);
	
	if(windowMonitor == NULL)
	{
		glfwGetWindowSize(window, &windowedWidth, &windowedHeight);
		glfwGetWindowPos(window, &windowedXPos, &windowedYPos);
		glfwSetWindowMonitor(
			window, 
			primaryMonitor, 
			0,0,
			vidmode->width,
			vidmode->height,
			vidmode->refreshRate
		);
	}
	else
	{
		glfwSetWindowMonitor(
			window,
			NULL,
			windowedXPos, windowedYPos,
			windowedWidth, windowedHeight,
			vidmode->refreshRate
		);
	}
	return window;
}
unsigned int loadShader(const char* vertexShader, const char* fragmentShader)
{
	int success;
	char infoLog[512];

	FILE* vertFilePtr = fopen(vertexShader, "r");
	if (vertFilePtr == NULL) {
		printf("Cannot open %s", vertexShader);
		return -1;
	}
	long int vertFileSize = getFileSize(vertFilePtr);
	char vertexShaderCodeArray[vertFileSize + 1];

	int next = 0;
	int index = 0;
	while(next != EOF)
	{
		next = fgetc(vertFilePtr);		
		if(next == EOF)
			vertexShaderCodeArray[index] = 0;
		else
			vertexShaderCodeArray[index] = next;
		index++;
	}
	
	fclose(vertFilePtr);
	
	const char* vertexShaderCode = vertexShaderCodeArray;

	unsigned int vertexID = glCreateShader(GL_VERTEX_SHADER);
	glShaderSource(vertexID, 1, &vertexShaderCode, NULL);
	glCompileShader(vertexID);

	glGetShaderiv(vertexID, GL_COMPILE_STATUS, &success);

	if(!success)
	{
		glGetShaderInfoLog(vertexID, 512, NULL, infoLog);
		printf("ERROR::SHADER::VERTEX::COMPILATION_FAILED\n%s\n", infoLog);
		return -1;
	}

	FILE* filePtr = fopen(fragmentShader, "r");
	if (filePtr == NULL) {
		printf("Cannot open %s", fragmentShader);
		return -1;
	}
	long int fileSize = getFileSize(filePtr);
	char fragmentShaderCodeArray[fileSize + 1];

	next = 0;
	index = 0;
	while(next != EOF)
	{
		next = fgetc(filePtr);
		if(next == EOF)
			fragmentShaderCodeArray[index] = 0;
		else
			fragmentShaderCodeArray[index] = next;
		index++;
	}

	fragmentShaderCodeArray[index] = 0;

	const char* fragmentShaderCode = fragmentShaderCodeArray;

	unsigned int fragmentID = glCreateShader(GL_FRAGMENT_SHADER);
	glShaderSource(fragmentID, 1, &fragmentShaderCode, NULL);
	glCompileShader(fragmentID);

	glGetShaderiv(fragmentID, GL_COMPILE_STATUS, &success);

	if(!success)
	{
		glGetShaderInfoLog(fragmentID, 512, NULL, infoLog);
		printf("ERROR::SHADER::FRAGMENT::COMPILATION_FAILED\n%s\n", infoLog);
		return -1;
	}

	unsigned int shaderID = glCreateProgram();
	glAttachShader(shaderID, vertexID);
	glAttachShader(shaderID, fragmentID);
	glLinkProgram(shaderID);
	// print linking errors if any
	glGetProgramiv(shaderID, GL_LINK_STATUS, &success);
	if(!success)
	{
		glGetProgramInfoLog(shaderID, 512, NULL, infoLog);
		printf("ERROR::SHADER::PROGRAM::LINKING_FAILED\n%s\n", infoLog);
	}

	glDeleteShader(vertexID);
	glDeleteShader(fragmentID);

	return shaderID;
}

long int getFileSize(FILE *filePtr)
{
	fpos_t pos;
	if (fgetpos(filePtr, &pos) != 0)
	{
		printf("get position failed");
		return -1;
	}
	
	if(fseek(filePtr, 0, SEEK_END) != 0)
	{
		printf("Seek to end of file failed");
		return -1;
	}

	long int filePos = ftell(filePtr);
	if(filePos == -1L)
	{
		printf("Failed to get file position");
		return -1;
	}

	if (fsetpos(filePtr, &pos) != 0)
	{
		printf("set position failed");
		return -1;
	}

	return filePos;
}

static SDL_AudioStream *stream = NULL;
static Uint8 *wav_data = NULL;
static Uint32 wav_data_len = 0;
//TODO : Put in an Audio.c file
bool loadMusic()
{
	Uint32 length;
	Uint8 * buffer;
	SDL_AudioSpec spec;

	if (SDL_LoadWAV(musicFile, &spec, &wav_data, &wav_data_len) == false)
	{
		printf("Failed to Load WAV at %s", musicFile);
		return false;
	}
	
	stream = SDL_OpenAudioDeviceStream(SDL_AUDIO_DEVICE_DEFAULT_PLAYBACK, &spec, NULL, NULL);	
	if(stream == false)
	{
		printf("Failed to open music");
		return false;
	}
	return true;
}
void beginPlayMusic()
{
	SDL_ResumeAudioStreamDevice(stream);
}
void frameUpdateMusic()
{
	if (SDL_GetAudioStreamQueued(stream) < (int)wav_data_len) {
        /* feed more data to the stream. It will queue at the end, and trickle out as the hardware needs more data. */
        SDL_PutAudioStreamData(stream, wav_data, wav_data_len);
    }
}
void closeMusic()
{
	SDL_free(wav_data);
}
