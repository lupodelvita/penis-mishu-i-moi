---
name: ai promt 2.0
description: A comprehensive AI prompt for initializing, planning, optimizing, and deploying scalable applications with security, performance, and CI/CD considerations.
---
# Comprehensive AI Agent Project Plan

This document provides a unified plan for initializing, planning, and optimizing your project. It covers **technology selection**, **architecture design**, **security practices**, **performance optimization**, and **CI/CD setup** in a single unified guide.


- **Starting a new project** and needing guidance on selecting technologies (e.g., programming languages, frameworks, databases).
- **Planning the project's architecture**, considering options like monolithic vs. microservices and defining service boundaries.
- **Ensuring security** by addressing data protection, encryption, authentication, and prevention of vulnerabilities (e.g., SQL injection, XSS).
- **Optimizing performance**, including caching, query optimization, background jobs, and scalability considerations.
- **Setting up CI/CD pipelines** for continuous integration and deployment, including best practices for automated testing and production deployment.

---

## Project Setup, Architecture, Security, and Optimization Plan

### Objective:
Set up, plan, and optimize the project, covering technology choices, architecture, security, and performance.

```markdown
name: projectPlan
description: Comprehensive project plan for initializing, securing, optimizing, and deploying a scalable application
argument-hint: Describe the project details and goals for specific technology and architecture needs
agent: agent
---

### Project Guidelines

#### Code Style
- Define **language** and **formatting preferences**. Provide clear rules for naming conventions, indentation, and commenting. Reference key files that exemplify coding style and conventions.
- Specify **multi-line statements**, **variable naming**, and **code documentation** practices.

#### Architecture
- Suggest **architecture pattern** (e.g., monolithic, microservices, serverless) based on project scale. Justify the choice considering scalability, maintainability, and team expertise.
- Define the **major components** and their interactions: frontend, backend, APIs, services.
- Outline **data flow** and **service boundaries** for the entire system.

#### Build and Test
- Provide **installation commands** and **build processes** to get the project up and running (e.g., `npm install`, `docker build`).
- Outline **test frameworks** and **commands** for automated testing (e.g., `pytest`, `jest`, `cypress`).
- Include instructions for **CI/CD pipelines** and deployment automation tools (e.g., GitHub Actions, Jenkins).

#### Project Conventions
- Highlight **project-specific patterns** that differ from industry standards, such as error handling, service interaction, or logging.
- Include examples and guidance on how to integrate **tools and libraries** consistently (e.g., TypeScript with React, Django for Python backends).

#### Integration Points
- Outline **external dependencies** and **third-party services**. Provide documentation on how these services should be integrated securely (authentication, data handling).
- Recommend **best practices** for securely interacting with third-party services and libraries.

#### Security
- Identify **critical areas** for **data protection** and secure coding practices.
- Recommend **security protocols** (e.g., OAuth 2.0, JWT) for **authentication** and **authorization**.
- Provide steps for **secure deployment** and protection against vulnerabilities (e.g., SQL Injection, XSS, CSRF).

---

### Planning and Architecture

#### Technology Stack
- Choose the **programming language** and **framework** that fit the project needs (e.g., Go for performance, Python for rapid development, React for frontend).
- Should we use **GraphQL** or **REST APIs**? If GraphQL is selected, define strategies for handling **queries** and **mutations** efficiently.

#### Architecture
- Should we use **monolithic** or **microservices** architecture? Justify the choice based on scalability and team expertise.
- If using **microservices**, outline the **service discovery** and **API Gateway** strategy. Recommend tools like **Docker** and **Kubernetes** for containerization and orchestration.
- Define the approach for **API versioning** and maintaining backward compatibility.

#### Database Selection
- Should we use **SQL** or **NoSQL**? If using SQL, recommend a database like **PostgreSQL** for transactional data. For NoSQL, suggest **MongoDB** for flexible schema design.
- Provide guidance on **schema design**, **normalization**, **indexing**, and **sharding** for scalability.

#### Security and Data Privacy
- Address **GDPR** or **local data privacy** regulations, such as **data anonymization** or **pseudonymization**.
- Define strategies for securely handling **personal data** and ensuring compliance with **privacy laws**.
- Implement **encryption** both **at rest** and **in transit** using **AES-256** and **TLS 1.2+**.

#### External Dependencies
- List any **third-party services** (e.g., payments, messaging) and tools, providing guidelines for securely integrating them.
- Discuss **third-party APIs** and how to securely manage authentication and data flow with them.

#### Scalability
- Define **scaling strategies** (horizontal vs. vertical) based on traffic projections and required performance.
- Should we consider **auto-scaling** using **cloud services** (AWS, Azure, GCP)? Consider using **load balancing** and **cloud-native databases**.

---

### Performance Optimization and CI/CD Setup

#### Performance Optimization
- Implement **caching** with **Redis** or **Memcached** to reduce load. How to store frequently accessed data for faster retrieval?
- Optimize **database queries** with **indexing**, **query optimization**, and **read/write splitting**.
- Should we use a **CDN** for faster content delivery and reduce server load?

#### Asynchronous Processing
- What heavy tasks (e.g., data processing, file uploads) should be moved to **background jobs**? Recommend tools like **Celery**, **RabbitMQ**, or **Kafka** for task management.
- How to ensure **idempotency** and **retry mechanisms** for background tasks?

#### Memory & CPU Optimization
- Use profiling tools to detect **memory leaks** and optimize **CPU usage**. Should we consider tools like **Valgrind** or **Prometheus** for performance profiling?

#### Security Hardening
- Ensure sensitive data is **encrypted** both **at rest** and **in transit**. Use **AES-256** for encryption and **TLS 1.2+** for secure communication.
- Implement a **WAF** for protection against **DDoS**, **SQL injection**, and **XSS** attacks.
- Follow **secure coding practices** like **input sanitization** and **secure storage of secrets**.

#### CI/CD & Deployment
- What tools should be used for **continuous integration and deployment** (e.g., **Jenkins**, **GitHub Actions**)? Define a streamlined deployment pipeline.
- Consider **Blue-Green deployment** or **Canary releases** for reducing downtime during production updates.
- How should we handle versioning and rolling back deployments?

#### Monitoring & Alerts
- Set up **monitoring** using **Prometheus**, **Grafana**, or **New Relic** to track performance and detect issues in real-time.
- Define thresholds for **alerts** (e.g., high memory usage, slow queries) and configure **logging** solutions like **ELK stack** or **Splunk** for tracking issues.
