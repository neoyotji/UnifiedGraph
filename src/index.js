const { ApolloServer, gql } = require('apollo-server');
const axios = require('axios');
const { userLoader } = require('./loaders');

// Şema Tasarımı
const typeDefs = gql`
  type User {
    id: ID!
    name: String!
    username: String!
    email: String!
    company: Company
  }

  type Company {
    name: String
    catchPhrase: String
  }

  type Post {
    id: ID!
    title: String!
    body: String!
    user: User # İşte sihir burada gerçekleşecek
  }

  type Query {
    posts: [Post]
    users: [User]
  }
`;

// Resolver Mantığı
const resolvers = {
  Query: {
    posts: async () => {
      const response = await axios.get('https://jsonplaceholder.typicode.com/posts');
      // Performans testi için sadece ilk 20 postu dönelim
      return response.data.slice(0, 20);
    },
    users: async () => {
      const response = await axios.get('https://jsonplaceholder.typicode.com/users');
      return response.data;
    },
  },
  Post: {
    // Post'un içindeki 'user' alanı istendiğinde burası çalışır
    user: (parent) => {
      // Tek tek axios.get çağırmak yerine loader'a "bunu kuyruğa ekle" diyoruz
      return userLoader.load(parent.userId);
    },
  },
};

const server = new ApolloServer({ typeDefs, resolvers });

server.listen().then(({ url }) => {
  console.log(`🚀  Gateway ready at ${url}`);
});