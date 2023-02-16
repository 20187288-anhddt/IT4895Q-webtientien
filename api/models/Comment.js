const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const opts = {
  timestamps: {
      currentTime: () => Math.floor(Date.now() / 1000),
      createdAt: 'created',
      updatedAt: 'modified',
  }
};

const commentSchema = Schema({
  comment: {
    type: String,
    required: true,
  },
  post: {
    type: Schema.Types.ObjectId,
    ref: "posts",
  },
  poster: {
    type: Schema.Types.ObjectId,
    ref: "users",
  },
  created: Number,
  modified: Number,
}, opts);

module.exports = Comment = mongoose.model("comments", commentSchema);
