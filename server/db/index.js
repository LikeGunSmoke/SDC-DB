const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

const url = 'mongodb://localhost:27017';

const dbName = 'reviewsWarehouse';
const client = new MongoClient(url, {useNewUrlParser: true, useUnifiedTopology: true});

client.connect((err) => {
  assert.equal(null, err);
  console.log('Connected to MongoDB Server');

  const db = client.db(dbName);

    client.close();

});
