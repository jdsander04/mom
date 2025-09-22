# --- Frontend (React + Vite + SWC) ---
FROM node:20-slim

# Set work directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Run dev server
CMD ["npm", "run", "dev", "--", "--host"]
