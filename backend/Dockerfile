# Use official Node image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first (for caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all source code
COPY . .

# Generate Prisma client (needed for TS build)
RUN npx prisma generate

# Build TypeScript (if using TS)
RUN npm run build

# Expose port (match your app port)
EXPOSE 5000

# Start the app
CMD ["npm", "run", "start"]