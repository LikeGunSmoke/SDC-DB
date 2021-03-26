const path = require('path');

const express = require('express');
const mongoose = require('mongoose'); // added by me

// const helpers = require('./helpers');

const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.json({limit: '500kb'}));
app.use(express.urlencoded({limit: '500kb', extended: true}));

// Added by me



mongoose.connect('mongodb://localhost/reviewsWarehouse', {useNewUrlParser: true, useUnifiedTopology: true});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error'));

db.once('open', () => {
  console.log('Connected to Mongoose');
})

const reviews_photos = new mongoose.Schema({
  id: Number,
  review_id: Number,
  url: String
}, {collection: 'reviews_photos'});

const characteristics = new mongoose.Schema({
  id: {type: Number,  index: true},
  product_id: Number,
  name: String,
}, {collection: 'characteristics'});

const characteristic_reviews = new mongoose.Schema({
  id: Number,
  characteristic_id: Number,
  review_id: Number,
  value: Number,
}, {collection: 'characteristic_reviews'});

const reviews = new mongoose.Schema({
  id: {type: Number, index: true},
  product_id: {type: Number,  index: true},
  rating: Number,
  date: Date,
  summary: String,
  body: String,
  recommend: Boolean,
  reported: Boolean,
  reviewer_name: String,
  reviewer_email: String,
  response: String,
  helpfulness: Number,

}, {collection: 'reviews'});

const reviewsModel = mongoose.model('review', reviews);
const charsModel = mongoose.model('characteristics', characteristics);
const charsRevModel = mongoose.model('characteristic_reviews', characteristic_reviews);
const photosModel = mongoose.model('reviews_photos', reviews_photos);

// get all reviews for a given product
app.get('/api/reviews/:product_id', (req, res) => {

  reviews.virtual('photos', {
    ref: 'reviews_photos',
    localField: 'id',
    foreignField: 'review_id'
  })

  // Not sure I'll need this
  // reviews.virtual('characteristics', {
  //   ref: 'characteristic_reviews',
  //   localField: 'id',
  //   foreignField: 'review_id'
  // })
  // .populate('characteristics') // add to query chain below if needed

  reviewsModel.find({product_id: req.params.product_id})

    .populate('photos')
    .exec((err, data) => {
      if (err) {
        console.log(err)
        res.status(400).send(err);
      } else {
        res.status(200).send(data)
      }
    })
})
// add review // testing out different query types, like the other ones better though...
app.put('/api/reviews', (req, res) => {
  reviewsModel.create(req.query)
    .then((data) => {
      res.status(201).send(data);
    })
    .catch((err) => {
      res.status(400).send(err);
    })
})
// update recommend status for given review
app.put('/api/reviews/:product_id/:id/recommend', (req, res) => {
  reviewsModel.findOneAndUpdate({id: req.params.id}, {recommend: true}, (err, data) => {
    if (err) {
      res.status(400).send(err);
    } else {
      res.status(204).send(data);
    }
  })
})
// update reported status for a given review
app.put('/api/reviews/:product_id/:id/report', (req, res) => {
  reviewsModel.findOneAndUpdate({id: req.params.id}, {reported: true}, (err, data) => {
    if (err) {
      res.status(400).send(err);
    } else {
      res.status(204).send(data);
    }
  })
})
// increment helpfulness property by one for a given review
app.put('/api/reviews/:product_id/:id/helpful', (req, res) => {
  reviewsModel.findOneAndUpdate({id: req.params.id}, {$inc: {helpfulness: 1}}, (err, data) => {
    if (err) {
      res.status(400).send(err);
    } else {
      res.status(200).send(data);
    }
  })
})
// add a photo to a given review
app.put('/api/reviews/:product_id/:id/photo', (req, res) => {
  const url = req.query.url;
  let reviewImg = new reviewsModel();
  reviewImg.photos.push(photosModel.create({review_id: req.params.id, url: url}))

  photosModel.create({review_id: req.params.id, url: url}, (err, data) => {
    if (err) {
      res.status(400).send(err);
    } else {
      res.status(200).send(data);
    }
  })
})
// get all photos for a given review
app.get('/api/reviews/:product_id/:id/photo', (req, res) => {
  photosModel.find({review_id: req.params.id}, (err, data) => {
    if (err) {
      res.status(400).send(err);
    } else {
      res.status(200).send(data);
    }
  })
})

// Organize data
const organize = (arr) => {

  // arr is a mongoose document obj, sent as json string, parse to access stored methods/vars
  arr = JSON.parse(arr);

  const ratings = {};
  const recommended = {true: 0, false: 0};
  const chars = {};
  let productId;

  // get characteristic names
  arr[1].characteristics.forEach((char) => {
    chars[char.name] === undefined ? chars[char.name] = {id: char.id, value: 0} : null
  })

  arr.forEach((review) => {
    productId = review.product_id;
    // accumulate ratings
    ratings[review.rating] === undefined ? ratings[review.rating] = 1 : ratings[review.rating] = ratings[review.rating] + 1;
    // accumulate recommendations
    if (review.recommend === true) {
      recommended.true === 0 ? recommended.true = 1 : recommended.true = (recommended.true + 1);
    } else if (review.recommend === false) {
      recommended.false === 0 ? recommended.false = 1 : recommended.false = (recommended.false + 1)
    };
    // accumulate statistics
    review.stats.forEach((stat) => {
      for(let name in chars) {
        stat.characteristic_id === chars[name].id ? chars[name].value += stat.value : null
      }
    })
  })

  let result = {
    product_id: productId,
    ratings: ratings,
    recommended: recommended,
    characteristics: chars,

  }
  return result;
}

// get review meta data for a given product
app.get('/api/reviews/:product_id/meta', (req, res) => {

  reviews.virtual('characteristics', {
    ref: 'characteristics',
    localField: 'product_id',
    foreignField: 'product_id'
  })
  reviews.virtual('stats', {
    ref: 'characteristic_reviews',
    localField: 'id',
    foreignField: 'review_id'
  })

   reviewsModel.find({product_id: req.params.product_id})
  .select('id rating recommend product_id')
  .populate('characteristics')
  .populate('stats')
  .exec((err, data) => {
    if (err) {
      res.status(400).send(err);
    } else {
      // data is mongoose document obj, convert to json to use/modify methods/vars
      res.status(200).send(organize(JSON.stringify(data)));
    }
  })
})

// these are for viewing sake
// returns name of chars per product
app.get('/api/reviews/:product_id/chars', (req, res) => {
  charsModel.find({product_id: req.params.product_id}, (err, data) => {
    if (err) {
      res.status(400).send(err);
    } else {
      res.status(200).send(data);
    }
  })
})
// returns characteristics for a given review
app.get('/api/reviews/:product_id/:id/chars', (req, res) => {
  charsRevModel.find({id: req.params.id}, (err, data) => {
    if (err) {
      res.status(400).send(err);
    } else {
      res.status(200).send(data);
    }
  })
})





app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
});
