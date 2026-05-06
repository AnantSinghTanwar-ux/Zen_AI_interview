import { DomainTopic } from "./types";

export const DOMAIN_TOPICS: DomainTopic[] = [
  // ─── Frontend ────────────────────────────────────────────────
  {
    topic: "React & Frameworks",
    subtopics: ["Hooks & Lifecycle", "Server Components", "State Management (Redux/Zustand)", "Next.js App Router"],
    difficulty: "Medium",
    commonQuestions: [
      "How does React's Virtual DOM actually work under the hood?",
      "Explain the difference between useMemo and useCallback with practical examples.",
      "How do React Server Components differ from SSR? What are the limitations?",
    ],
    companies: ["meta", "airbnb", "netflix", "cred", "swiggy"],
  },
  {
    topic: "Web Performance",
    subtopics: ["Core Web Vitals", "Critical Rendering Path", "Code Splitting", "Image Optimization"],
    difficulty: "Hard",
    commonQuestions: [
      "How would you optimize the Time to Interactive (TTI) for a large e-commerce homepage?",
      "Explain layout thrashing and how to prevent it.",
      "How do you implement infinite scrolling without degrading DOM performance?",
    ],
    companies: ["google", "amazon", "flipkart", "adobe"],
  },
  {
    topic: "JavaScript Core",
    subtopics: ["Event Loop", "Closures & Scope", "Prototypal Inheritance", "Promises & Async/Await"],
    difficulty: "Medium",
    commonQuestions: [
      "Explain the difference between microtasks and macrotasks in the event loop.",
      "Implement a polyfill for Promise.all.",
      "What is 'this' in JavaScript and how does arrow function behavior differ?",
    ],
    companies: ["uber", "atlassian", "microsoft", "salesforce"],
  },

  // ─── Backend ─────────────────────────────────────────────────
  {
    topic: "Database Design & Optimization",
    subtopics: ["Indexing", "ACID Properties", "Sharding & Partitioning", "Query Optimization"],
    difficulty: "Hard",
    commonQuestions: [
      "When would you choose a NoSQL database over a SQL database?",
      "Explain how B-tree indexes work in PostgreSQL.",
      "How do you handle dirty reads and phantom reads in a transaction?",
    ],
    companies: ["amazon", "oracle", "uber", "zomato"],
  },
  {
    topic: "API Architecture",
    subtopics: ["REST vs GraphQL vs gRPC", "Idempotency", "Rate Limiting", "API Gateways"],
    difficulty: "Medium",
    commonQuestions: [
      "Design an idempotent API for processing payments.",
      "What are the pros and cons of moving from REST to GraphQL?",
      "How would you implement pagination for a high-traffic endpoint?",
    ],
    companies: ["stripe", "razorpay", "atlassian", "netflix"],
  },
  {
    topic: "Microservices & Distributed Systems",
    subtopics: ["Event-Driven Architecture", "Saga Pattern", "Service Discovery", "Message Queues (Kafka/RabbitMQ)"],
    difficulty: "Hard",
    commonQuestions: [
      "How do you handle distributed transactions across multiple microservices?",
      "Explain exactly-once delivery semantics in message queues.",
      "How does Kafka handle consumer failures?",
    ],
    companies: ["uber", "netflix", "amazon", "linkedin"],
  },

  // ─── Cloud & DevOps ──────────────────────────────────────────
  {
    topic: "Containerization & Orchestration",
    subtopics: ["Docker internals", "Kubernetes Architecture", "Service Mesh", "Helm"],
    difficulty: "Hard",
    commonQuestions: [
      "Explain the Kubernetes Control Plane components.",
      "How do you handle secrets management in a containerized environment?",
      "What is the difference between a Deployment and a StatefulSet in K8s?",
    ],
    companies: ["google", "microsoft", "amazon", "salesforce"],
  },
  {
    topic: "Infrastructure as Code & CI/CD",
    subtopics: ["Terraform", "GitHub Actions", "Blue-Green Deployment", "Immutable Infrastructure"],
    difficulty: "Medium",
    commonQuestions: [
      "How do you manage Terraform state in a multi-developer environment?",
      "Explain the steps to implement a zero-downtime deployment pipeline.",
      "How do you test infrastructure code?",
    ],
    companies: ["atlassian", "netflix", "apple", "adobe"],
  },

  // ─── AI & Machine Learning ───────────────────────────────────
  {
    topic: "Generative AI & LLMs",
    subtopics: ["RAG (Retrieval-Augmented Generation)", "Vector Databases", "Prompt Engineering", "Fine-tuning"],
    difficulty: "Medium",
    commonQuestions: [
      "Explain the architecture of a typical RAG system.",
      "How do Vector Databases calculate similarity (Cosine vs Dot Product)?",
      "What are the challenges in deploying LLMs to production?",
    ],
    companies: ["meta", "microsoft", "google", "openai", "anthropic"],
  },
  {
    topic: "Core ML & Data Pipelines",
    subtopics: ["Feature Engineering", "Model Evaluation Metrics", "Data Streaming (Spark/Flink)", "Overfitting"],
    difficulty: "Hard",
    commonQuestions: [
      "How do you handle highly imbalanced datasets in classification problems?",
      "Explain the difference between precision, recall, and F1 score.",
      "How would you build a real-time recommendation data pipeline?",
    ],
    companies: ["netflix", "amazon", "uber", "spotify"],
  },
];
