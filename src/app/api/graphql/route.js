import { ApolloServer } from '@apollo/server'
import { startServerAndCreateNextHandler } from '@as-integrations/next'
import { typeDefs } from '@/src/graphql/typeDefs'
import { resolvers } from '@/src/graphql/resolvers'

const server = new ApolloServer({
  typeDefs,
  resolvers,
})

const handler = startServerAndCreateNextHandler(server, {
  context: async (req, res) => ({ req, res }),
})

export const GET = handler
export const POST = handler

// Optional: ensure dynamic to avoid caching issues
export const dynamic = 'force-dynamic'
