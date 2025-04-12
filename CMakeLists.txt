cmake_minimum_required(VERSION 3.5.0)

set( CMAKE_C_COMPILER "gcc" )

project(PwCRevision2025 LANGUAGES C VERSION 3.5.0)

set(CMAKE_C_STANDARD 99)
set(CMAKE_C_STANDARD_REQUIRED ON)

# These are the options we select for building GLFW as a library
set(GLFW_BUILD_DOCS OFF CACHE BOOL "" FORCE)        # Don't build Documentation
set(GLFW_BUILD_TESTS OFF CACHE BOOL "" FORCE)       # Don't build Tests
set(GLFW_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)    # Don't build Examples
set(GLFW_INSTALL OFF CACHE BOOL "" FORCE)           # Don't build Installation Information
set(GLFW_USE_HYBRID_HPG ON CACHE BOOL "" FORCE)     # Add variables to use High Performance Graphics Card if available
add_subdirectory(libs/glfw)                       # Build the GLFW project to use later as a library

if (UNIX)
        set(SDL_VIDEO_DRIVER x11)
        set(SDL_WAYLAND OFF)
        set(SDL_WAYLAND_SHARED OFF)
        set(SDL_UNIX_CONSOLE_BUILD ON)
endif (UNIX)
add_subdirectory(libs/SDL EXCLUDE_FROM_ALL)

set(LIBRARIES libs/glad/src/gl.c)

# Define the directories in which to search for the included headers
include_directories(
        src
        libs/glfw/include
        libs/glad/include
        libs/SDL/include
)

add_executable(${PROJECT_NAME} src/main.c ${LIBRARIES})

target_link_libraries(${PROJECT_NAME} glfw SDL3::SDL3)

