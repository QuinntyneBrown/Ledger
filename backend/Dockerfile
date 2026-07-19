FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY global.json Directory.Build.props ./
COPY backend ./backend
WORKDIR /src/backend
RUN dotnet restore Ledger.slnx \
    && dotnet publish src/Ledger.Api/Ledger.Api.csproj -c Release -o /out --no-restore \
    && dotnet publish src/Ledger.Cli/Ledger.Cli.csproj -c Release -o /cli --no-restore
FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /out .
COPY --from=build /cli /app/cli
RUN mkdir -p /app/wwwroot/avatars
EXPOSE 8080
ENTRYPOINT ["dotnet","Ledger.Api.dll"]
