import { SystemDesignQuestion } from "./types";

export const SYSTEM_DESIGN_QUESTIONS: SystemDesignQuestion[] = [
  // ─── Core Architecture ──────────────────────────────────────
  {
    id: "sd-core-1", category: "Core Architecture", title: "Design a URL Shortener",
    prompt: "Design a highly available and scalable URL shortener service like Bitly. It should handle millions of short links per day and provide redirection with minimum latency.",
    whatInterviewerLooksFor: "Capacity estimation, encoding algorithms (Base62), database indexing, cache (Redis), handling race conditions during alias creation.",
    companies: ["google", "amazon", "microsoft", "meta", "bloomberg"],
    seniority: ["mid", "senior"], topics: ["Hashing", "Caching", "Database Scaling"],
  },
  {
    id: "sd-core-2", category: "Core Architecture", title: "Design a Rate Limiter",
    prompt: "Design an API rate limiter to protect our services from being overwhelmed. It should support different rate limiting rules for different API endpoints and IP addresses.",
    whatInterviewerLooksFor: "Algorithms (Token Bucket, Leaky Bucket, Sliding Window), Redis usage, latency overhead mitigation, distributed counter synchronization.",
    companies: ["stripe", "amazon", "google", "uber", "atlassian"],
    seniority: ["mid", "senior"], topics: ["Concurrency", "Redis", "Distributed Systems"],
  },
  {
    id: "sd-core-3", category: "Core Architecture", title: "Design a Key-Value Store",
    prompt: "Design a highly available distributed key-value store (similar to Cassandra or DynamoDB).",
    whatInterviewerLooksFor: "Consistent Hashing, CAP Theorem, Quorum consensus, Vector Clocks, Merkle Trees for anti-entropy, Gossip protocol.",
    companies: ["amazon", "meta", "google", "apple", "netflix"],
    seniority: ["senior", "staff"], topics: ["Distributed Systems", "Consistency", "CAP Theorem"],
  },

  // ─── Social Networks & Feeds ──────────────────────────────
  {
    id: "sd-social-1", category: "Social Networks", title: "Design a News Feed System",
    prompt: "Design a news feed system for a social network like Twitter or Facebook. Users should see updates from people they follow in reverse chronological order.",
    whatInterviewerLooksFor: "Fan-out on write vs Fan-out on read (Push vs Pull models), handling celebrity users (hybrid model), caching feeds, ranking algorithms.",
    companies: ["meta", "linkedin", "twitter", "instagram"],
    seniority: ["mid", "senior", "staff"], topics: ["Fanout", "Caching", "Message Queues"],
  },
  {
    id: "sd-social-2", category: "Social Networks", title: "Design a Chat Application",
    prompt: "Design a real-time chat application like WhatsApp or Discord. It should support 1-on-1 chatting, group chats, and online presence indicators.",
    whatInterviewerLooksFor: "WebSockets vs Long Polling, message delivery guarantees, stateful chat servers, read receipts, message sequencing.",
    companies: ["meta", "microsoft", "discord", "slack"],
    seniority: ["mid", "senior"], topics: ["WebSockets", "Real-time", "Database Sharding"],
  },

  // ─── Media & Streaming ────────────────────────────────────
  {
    id: "sd-media-1", category: "Media & Streaming", title: "Design YouTube",
    prompt: "Design a video sharing platform like YouTube. Users should be able to upload videos, view them seamlessly, and search for content.",
    whatInterviewerLooksFor: "Video processing pipelines, BLOB storage, Content Delivery Networks (CDNs), streaming protocols (DASH, HLS), handling viral videos.",
    companies: ["google", "netflix", "meta", "amazon"],
    seniority: ["senior", "staff"], topics: ["CDN", "Video Encoding", "Storage"],
  },
  {
    id: "sd-media-2", category: "Media & Streaming", title: "Design Netflix (Video Streaming)",
    prompt: "Design a subscription-based video streaming service like Netflix. Focus on content delivery and the recommendation engine architecture.",
    whatInterviewerLooksFor: "Open Connect (custom CDN approach), DRM, microservices architecture, chaos engineering concepts, recommendation data pipelines.",
    companies: ["netflix", "amazon", "apple"],
    seniority: ["senior", "staff"], topics: ["Streaming", "Microservices", "Data Pipelines"],
  },

  // ─── Real-time & Location ─────────────────────────────────
  {
    id: "sd-geo-1", category: "Real-time & Location", title: "Design a Ride-Hailing App",
    prompt: "Design a ride-hailing service like Uber or Lyft. How would you match riders with drivers and track locations in real-time?",
    whatInterviewerLooksFor: "Geospatial indexing (Quadtrees, Geohash), handling high-frequency location updates, dispatch algorithms, trip state management.",
    companies: ["uber", "lyft", "grab", "swiggy", "zomato"],
    seniority: ["senior", "staff"], topics: ["Geospatial Indexing", "Real-time Updates", "Matching"],
  },
  {
    id: "sd-geo-2", category: "Real-time & Location", title: "Design Proximity Service (Yelp)",
    prompt: "Design a proximity server to discover nearby attractions like Yelp or Google Maps. It should allow searching for places within a specific radius.",
    whatInterviewerLooksFor: "Geohashing vs Quadtrees, read-heavy system optimizations, spatial database extensions (PostGIS), pagination for nearby results.",
    companies: ["google", "zomato", "yelp", "airbnb"],
    seniority: ["mid", "senior"], topics: ["Spatial Databases", "Caching", "Search"],
  },

  // ─── E-Commerce & Payments ────────────────────────────────
  {
    id: "sd-ecom-1", category: "E-Commerce", title: "Design Amazon (E-commerce Platform)",
    prompt: "Design a scalable e-commerce platform. Focus on the shopping cart, checkout process, and inventory management.",
    whatInterviewerLooksFor: "Database transactions (ACID vs BASE), inventory locking mechanisms, idempotent payment processing, handling flash sales.",
    companies: ["amazon", "flipkart", "meesho"],
    seniority: ["mid", "senior", "staff"], topics: ["ACID", "Idempotency", "Inventory Locks"],
  },
  {
    id: "sd-ecom-2", category: "E-Commerce", title: "Design a Payment Gateway",
    prompt: "Design a robust payment gateway like Stripe or Razorpay. It must securely process millions of transactions with exactly-once execution guarantees.",
    whatInterviewerLooksFor: "Idempotency keys, two-phase commit or saga pattern, webhook reliability, PCI compliance considerations, retry mechanisms with exponential backoff.",
    companies: ["stripe", "razorpay", "phonepe", "paypal", "square"],
    seniority: ["senior", "staff"], topics: ["Payments", "Saga Pattern", "Security"],
  },

  // ─── Data & Search ────────────────────────────────────────
  {
    id: "sd-data-1", category: "Data & Search", title: "Design a Web Crawler",
    prompt: "Design a scalable web crawler to index the entire web. It needs to be polite, handle billions of pages, and be fault-tolerant.",
    whatInterviewerLooksFor: "URL frontier (queue), DNS resolution bottlenecks, HTML parsing, cycle detection (checksums/Bloom filters), politeness constraints.",
    companies: ["google", "microsoft", "yahoo"],
    seniority: ["senior", "staff"], topics: ["Queues", "Bloom Filters", "Distributed Processing"],
  },
  {
    id: "sd-data-2", category: "Data & Search", title: "Design a Typeahead (Autocomplete) System",
    prompt: "Design a search autocomplete system for a search engine. It should return the top 5 most popular queries that match the prefix typed so far.",
    whatInterviewerLooksFor: "Trie data structure optimization, aggregators/MapReduce to compute frequencies, caching at edge, sampling data streams.",
    companies: ["google", "amazon", "linkedin", "meta"],
    seniority: ["mid", "senior"], topics: ["Tries", "Data Aggregation", "Edge Caching"],
  },
];
