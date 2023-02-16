const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const searchSchema = Schema(
  {
    user: {
        type: Schema.Types.ObjectId,
        ref: 'users',
    },
    keyword: {
        type: Schema.Types.String,
        required: true,
    },
    created: {
        type: Schema.Types.Date,
        default: Date.now
    }
  }
);

module.exports = Search = mongoose.model('search', searchSchema);
