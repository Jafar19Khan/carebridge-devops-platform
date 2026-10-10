pipeline {
  agent any
  environment {
    COMPOSE_PROJECT_NAME = 'carebridge-ci'
  }
  stages {
    stage('Validate toolchain') {
      steps {
        sh 'docker --version'
        sh 'docker compose version'
      }
    }
    stage('Prepare configuration') {
      steps {
        sh 'cp .env.example .env'
        sh 'docker compose -f docker-compose.yml -f docker-compose.local.yml config --quiet'
      }
    }
    stage('Build') {
      steps {
        sh 'docker compose -f docker-compose.yml -f docker-compose.local.yml build --pull'
      }
    }
    stage('Backend tests') {
      steps {
        sh 'docker run --rm carebridge-ci-backend npm run check'
        sh 'docker run --rm carebridge-ci-backend npm test'
      }
    }
  }
  post {
    always {
      sh 'docker compose -f docker-compose.yml -f docker-compose.local.yml down -v --remove-orphans || true'
      sh 'rm -f .env || true'
    }
  }
}
