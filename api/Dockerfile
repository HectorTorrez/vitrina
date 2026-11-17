# syntax=docker/dockerfile:1
FROM golang:1.27-bookworm AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY *.go ./
# CGO stays on because the SQLite importer links against libsqlite3.
RUN CGO_ENABLED=1 go build -trimpath -ldflags="-s -w" -o /out/vitrina-api .

FROM gcr.io/distroless/base-debian12:nonroot
COPY --from=build /out/vitrina-api /usr/local/bin/vitrina-api
ENV VITRINA_API_ADDR=0.0.0.0:8080
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/vitrina-api"]
