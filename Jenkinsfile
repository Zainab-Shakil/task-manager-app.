pipeline {
    agent any

    environment {
        DOCKERHUB_USER    = 'zainabshakil'
        IMAGE_NAME        = "${DOCKERHUB_USER}/task-manager"
        IMAGE_TAG         = "${BUILD_NUMBER}"
        KUBECONFIG        = '/var/lib/jenkins/.kube/config'
    }

    stages {

        // ─────────────────────────────────────────────────────
        // STAGE 1: CODE FETCH
        // ─────────────────────────────────────────────────────
        stage('Code Fetch') {
            steps {
                echo '=== Stage 1: Fetching source code from GitHub ==='
                git branch: 'main',
                    url: 'https://github.com/Zainab-Shakil/task-manager-app..git'
                sh 'ls -la'
                sh 'git log --oneline -5'
            }
        }

        // ─────────────────────────────────────────────────────
        // STAGE 2: DOCKER IMAGE CREATION
        // ─────────────────────────────────────────────────────
        stage('Docker Image Creation') {
            steps {
                echo '=== Stage 2: Building and pushing Docker image ==='
                script {
                    // Build the Docker image
                    def appImage = docker.build("${IMAGE_NAME}:${IMAGE_TAG}")

                    // Tag as latest
                    sh "docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${IMAGE_NAME}:latest"

                    // Push to DockerHub
                    docker.withRegistry('https://registry.hub.docker.com',
                                        'dockerhub-credentials') {
                        appImage.push("${IMAGE_TAG}")
                        appImage.push('latest')
                    }
                    echo "Image pushed: ${IMAGE_NAME}:${IMAGE_TAG}"
                }
            }
        }

        // ─────────────────────────────────────────────────────
        // STAGE 3: KUBERNETES DEPLOYMENT
        // ─────────────────────────────────────────────────────
        stage('Kubernetes Deployment') {
            steps {
                echo '=== Stage 3: Deploying to Kubernetes cluster ==='
                script {
                    // Update the image tag in the deployment manifest
                    sh """
                        sed -i 's|zainabshakil/task-manager:latest|${IMAGE_NAME}:${IMAGE_TAG}|g' \
                        k8s/app-deployment.yaml
                    """

                    // Apply MongoDB resources
                    sh 'kubectl apply -f k8s/mongo-deployment.yaml --kubeconfig=${KUBECONFIG}'

                    // Wait for MongoDB to be ready
                    sh 'kubectl rollout status deployment/mongodb --timeout=120s --kubeconfig=${KUBECONFIG}'

                    // Apply application deployment and service
                    sh 'kubectl apply -f k8s/app-deployment.yaml --kubeconfig=${KUBECONFIG}'
                    sh 'kubectl apply -f k8s/app-service.yaml --kubeconfig=${KUBECONFIG}'

                    // Wait for rollout to complete
                    sh 'kubectl rollout status deployment/task-manager --timeout=180s --kubeconfig=${KUBECONFIG}'

                    // Display running pods
                    sh 'kubectl get pods -o wide --kubeconfig=${KUBECONFIG}'
                    sh 'kubectl get services --kubeconfig=${KUBECONFIG}'
                }
            }
        }

        // ─────────────────────────────────────────────────────
        // STAGE 4: PROMETHEUS / GRAFANA
        // ─────────────────────────────────────────────────────
        stage('Prometheus/Grafana Stage') {
            steps {
                echo '=== Stage 4: Deploying Prometheus and Grafana ==='
                script {
                    sh 'kubectl apply -f k8s/prometheus-configmap.yaml --kubeconfig=${KUBECONFIG}'
                    sh 'kubectl apply -f k8s/prometheus-deployment.yaml --kubeconfig=${KUBECONFIG}'
                    sh 'kubectl apply -f k8s/grafana-deployment.yaml --kubeconfig=${KUBECONFIG}'
                    sh 'kubectl rollout status deployment/prometheus --timeout=120s --kubeconfig=${KUBECONFIG}'
                    sh 'kubectl rollout status deployment/grafana --timeout=120s --kubeconfig=${KUBECONFIG}'
                    sh 'kubectl get pods --kubeconfig=${KUBECONFIG}'
                    echo "Prometheus: http://3.80.22.100:30090"
                    echo "Grafana:    http://3.80.22.100:30030"
                }
            }
        }
    }

    post {
        success {
            echo '✅ Pipeline completed successfully!'
            echo "Application URL: http://3.80.22.100:30080"
        }
        failure {
            echo '❌ Pipeline failed. Check stage logs above.'
        }
        always {
            // Clean up local Docker images to save disk space
            sh 'docker image prune -f || true'
        }
    }
}
