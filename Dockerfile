

FROM node
# install dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm i

# Copy all local files into the image.
COPY . .
CMD ["node", "collect_all.js"]