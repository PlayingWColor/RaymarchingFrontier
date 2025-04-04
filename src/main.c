#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <glad/gl.h>
#include <GLFW/glfw3.h>

void framebuffer_size_callback(GLFWwindow* window, int width, int height);

void processInput(GLFWwindow *window);

unsigned int loadShader(const char* vertexShader, const char* fragmentShader);

long int getFileSize(FILE *filePtr);

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
     0.5f,  0.5f, 0.0f,  // top right
     0.5f, -0.5f, 0.0f,  // bottom right
    -0.5f, -0.5f, 0.0f,  // bottom left
    -0.5f,  0.5f, 0.0f   // top left 
};
unsigned int indices[] = {  // note that we start from 0!
    0, 1, 3,   // first triangle
    1, 2, 3    // second triangle
}; 

const char *vertexShaderSource = "../assets/shader.vert";
const char *fragmentShaderSource = "../assets/shader.frag";

int main()
{
	//initialize and make window
	glfwInit();
	glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
	glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
	glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
	
	GLFWwindow* window = glfwCreateWindow(800, 600, "LearnOpenGL", NULL, NULL);
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
	glViewport(0, 0, 800, 600);

	glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);
	
	unsigned int shaderID = loadShader(vertexShaderSource,fragmentShaderSource);
			
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

	while(!glfwWindowShouldClose(window))
	{
		//begin render
		processInput(window);
		//paint window color
		glClearColor(0.2f, 0.3f, 0.3f, 1.0f);
		glClear(GL_COLOR_BUFFER_BIT);
		

		// ..:: Drawing code (in render loop) :: ..
		// 4. draw the object
		glUseProgram(shaderID);
		glBindVertexArray(VAO);
		glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_INT, 0);
		glBindVertexArray(0);
		
	
		//display render to screen
		glfwSwapBuffers(window);
		glfwPollEvents();    
	}
	
	glfwTerminate();

	return 0;
}

void framebuffer_size_callback(GLFWwindow* window, int width, int height)
{
    glViewport(0, 0, width, height);
}

void processInput(GLFWwindow *window)
{
    if(glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS)
        glfwSetWindowShouldClose(window, true);
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
	char vertexShaderCodeArray[vertFileSize];

	char next = '\0';
	int index = 0;
	while(next != EOF)
	{
		next = fgetc(vertFilePtr);
		vertexShaderCodeArray[index] = next;
		index++;
	}
	
	vertexShaderCodeArray[index] = '\0';

	const char* vertexShaderCode = &vertexShaderCodeArray[0];

	unsigned int vertexID = glCreateShader(GL_VERTEX_SHADER);
	glShaderSource(vertexID, 1, &vertexShaderCode, NULL);
	glCompileShader(vertexID);

	glGetShaderiv(vertexID, GL_COMPILE_STATUS, &success);

	if(!success)
	{
	    glGetShaderInfoLog(vertexID, 512, NULL, infoLog);
	    printf("ERROR::SHADER::FRAGMENT::COMPILATION_FAILED\n%s\n", infoLog);
    	return -1;
	}

	FILE* filePtr = fopen(fragmentShader, "r");
	if (filePtr == NULL) {
		printf("Cannot open %s", fragmentShader);
    	return -1;
	}
	long int fileSize = getFileSize(filePtr);
	char fragmentShaderCodeArray[fileSize];

	next = '\0';
	index = 0;
	while(next != EOF)
	{
		next = fgetc(filePtr);
		fragmentShaderCodeArray[index] = next;
		index++;
	}

	fragmentShaderCodeArray[index] = '\0';

	const char* fragmentShaderCode = &fragmentShaderCodeArray[0];

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
