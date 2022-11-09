FROM node:16 as builder


RUN mkdir /code

WORKDIR /code

COPY package.json package-lock.json /code/

RUN --mount=type=cache,target=/root/.npm npm install

COPY . /code

RUN npm run build

FROM nginx as web

COPY --from=builder /code/build /usr/share/nginx/html