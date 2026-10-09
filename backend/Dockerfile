FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

RUN apk add --no-cache curl && \
    addgroup -S appgroup && adduser -S appuser -G appgroup && \
    mkdir -p /app/data && \
    chown -R appuser:appgroup /app

# Copy pre-compiled JAR
COPY backend/target/*.jar app.jar

USER appuser

# Render dynamically sets PORT environment variable
ENV PORT=10000
EXPOSE ${PORT}

ENTRYPOINT ["sh", "-c", "java \
  -XX:+UseContainerSupport \
  -XX:MaxRAMPercentage=75.0 \
  -XX:+TieredCompilation \
  -XX:TieredStopAtLevel=1 \
  -Djava.security.egd=file:/dev/./urandom \
  -Dserver.port=${PORT} \
  -jar app.jar"]