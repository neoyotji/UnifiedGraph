const DataLoader = require('dataloader');
const axios = require('axios');

// User Loader: ID'leri toplar ve tek seferde çeker
const batchUsers = async (userIds) => {
  // Gelen ID'leri benzersiz yap (Tekrar edenleri ele)
  const uniqueIds = [...new Set(userIds)];
  
  // JSONPlaceholder "id" parametresini array olarak kabul eder: ?id=1&id=2
  const params = uniqueIds.map(id => `id=${id}`).join('&');
  
  console.log(`[Networking] Fetching users for IDs: ${uniqueIds.join(', ')}`);
  
  const response = await axios.get(`https://jsonplaceholder.typicode.com/users?${params}`);
  const users = response.data;

  // DataLoader bizden girdiği sıra ile veriyi geri ister.
  // Çekilen veriyi, sorulan ID sırasına göre haritalıyoruz.
  return userIds.map(id => users.find(user => user.id === id));
};

const userLoader = new DataLoader(batchUsers);

module.exports = { userLoader };