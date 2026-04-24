# ── Stage 1: Build ────────────────────────────────────────────────────────────
# Use a full JDK image to compile and package the app with Maven
FROM maven:3.9.9-eclipse-temurin-21 AS builder

WORKDIR /app

# Copy the Maven config first (so Docker can cache the dependency download layer)
# If only your source code changes, Docker will reuse this cached layer and skip re-downloading deps
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Now copy the actual source code and build the JAR
COPY src ./src
RUN mvn clean package -DskipTests -B

# ── Stage 2: Run ──────────────────────────────────────────────────────────────
# Use a lightweight JRE-only image to actually run the app (much smaller than the build image)
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Install curl — your CdscHttpClient spawns curl as a subprocess, so it MUST be present
RUN apk add --no-cache curl

# Create a non-root user for security (never run apps as root in production)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Copy only the built JAR from the builder stage (not the entire Maven toolchain)
COPY --from=builder /app/target/*.jar app.jar

# Render will inject PORT as an environment variable; Spring Boot reads SERVER_PORT
# We expose 8080 as the default, but Render overrides this at runtime
EXPOSE 8080

# JVM flags:
#   -XX:+UseContainerSupport      → respect Docker memory limits (not host RAM)
#   -XX:MaxRAMPercentage=75.0     → use up to 75% of the container's RAM for the JVM heap
#   -Djava.security.egd=...       → faster startup (avoids blocking on /dev/random for entropy)
ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", "app.jar"]
