FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY ["TeamUp.Api.csproj", "./"]
RUN dotnet restore "TeamUp.Api.csproj"
COPY . .
RUN dotnet build "TeamUp.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "TeamUp.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "TeamUp.Api.dll"]

