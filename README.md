# Mom - Recipe and Meal Management System

Mom is a comprehensive application designed to streamline recipe management, meal planning, and grocery shopping. It combines a robust Django backend with a modern React frontend to provide a seamless user experience for organizing culinary activities.

## Features

- **Recipe Management**: Create, edit, and organize your favorite recipes.
- **Recipe Scraping**: Automatically import recipes from various websites.
- **Meal Planning**: specific calendar-based tools for planning meals.
- **Shopping Lists**: Generate and manage shopping lists based on your recipes and plans.
- **Dietary & Health Preferences**: Track and manage dietary restrictions and health-related goals.
- **User Management**: Secure user authentication and profile management.
- **Media Storage**: Efficient handling of recipe images and media using S3-compatible storage.

## Technology Stack

### Backend
- **Framework**: Django 5.2.6 & Django REST Framework 3.16.1
- **Database**: PostgreSQL 15
- **Task Queue**: Celery with Redis 7
- **API Documentation**: DRF Spectacular

### Frontend
- **Framework**: React 19 (via Vite)
- **Language**: TypeScript
- **UI Library**: Material UI (MUI) v7
- **Routing**: React Router DOM
- **Utilities**: Dayjs, Dnd-kit (Drag and Drop)

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Storage**: MinIO (S3 Compatible Object Storage)

## Prerequisites

Ensure you have the following installed on your system:
- Docker
- Docker Compose

## Installation and Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/jdsander04/mom.git
   cd mom
   ```

2. **Environment Configuration**
   The application requires environment variables for configuration. You can find example configuration files in the root and backend directories.

   - Create a `.env` file in the `backend/` directory based on `backend/example.env`.
   - Create a `.env` file in the root directory if applicable based on `example.env`.

3. **Build and Run the Application**
   Use Docker Compose to build and start the services.

   ```bash
   docker-compose up --build
   ```

   This command will start the following services:
   - **Backend**: Django application running on port 8000
   - **Frontend**: React application running on port 5173
   - **Database**: PostgreSQL database running on port 5432
   - **Redis**: Redis server running on port 6379
   - **MinIO**: Object storage service (API: 9000, Console: 9001)
   - **Celery**: Worker for background tasks

## Accessing the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **MinIO Console**: http://localhost:9001

## API Documentation

The project includes a Postman collection (`Mom API.postman_collection.json`) in the root directory, which contains a comprehensive list of API endpoints and usage examples.

## Project Structure

- **backend/**: Contains the Django source code, including apps for recipes, meal plans, users, and core functionality.
- **frontend/**: Contains the React source code, configured with Vite and TypeScript.
- **docker-compose.yml**: Orchestration file for defining and running multi-container Docker applications.

## Contribution

1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Make your changes and commit them with descriptive messages.
4. Push your changes to your fork.
5. Search for existing issues or open a new pull request.
