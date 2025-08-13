"use client";
import { ApolloClient, InMemoryCache, HttpLink, ApolloProvider } from "@apollo/client";
import { UserProvider } from "@auth0/nextjs-auth0/client";
import { ConfigProvider, App as AntApp, theme } from "antd";

const client = new ApolloClient({
  link: new HttpLink({ uri: "/api/graphql", credentials: "include" }),
  cache: new InMemoryCache(),
});

export default function Providers({ children }) {
  return (
    <UserProvider>
      <ApolloProvider client={client}>
        <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
          <AntApp>{children}</AntApp>
        </ConfigProvider>
      </ApolloProvider>
    </UserProvider>
  );
}
