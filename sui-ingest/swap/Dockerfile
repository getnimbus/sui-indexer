FROM node:18-alpine

WORKDIR /opt/nimbus-sui-indexer

COPY package.json .
COPY yarn.lock .
ADD prisma/schema.prisma prisma/schema.prisma
RUN corepack enable

VOLUME [ "/data" ]

# RUN apk add make cmake gcc g++ python3
RUN yarn

COPY . .
RUN yarn build

# RUN apk add curl && rm -rf /var/cache/apk/*

# HEALTHCHECK --interval=5s --timeout=30s CMD curl -f http://localhost:3000/ || exit 1

# EXPOSE 3000

CMD [ "yarn", "start" ]