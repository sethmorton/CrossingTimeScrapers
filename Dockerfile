

FROM node:18-bullseye
# install dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Copy all local files into the image.
COPY . .
CMD ["node", "merge.js"]