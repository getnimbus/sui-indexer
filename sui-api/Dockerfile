FROM node:18-alpine

WORKDIR /opt/nimbus-sui-indexer

ENV TZ=UTC

COPY package.json .
COPY yarn.lock .
ADD prisma/schema.prisma prisma/schema.prisma
RUN corepack enable

# RUN apk add make cmake gcc g++ python3
RUN yarn

COPY . .
RUN yarn build

# RUN apk add curl && rm -rf /var/cache/apk/*

EXPOSE 3000

CMD [ "yarn", "start" ]