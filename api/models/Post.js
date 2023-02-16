const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const postSchema = new Schema({
    author: {
        type: Schema.Types.ObjectId,
        ref: 'users',
        required: true
    },
    described: {
        type: String
    },
    status: {
        type: String
    },
    created: {
        type: Number
    },
    modified:  {
        type: Number
    },
    like: {
        type: Number
    },
    comment: {
        type: Number
    },
    likedUser: [{
        type: Schema.Types.ObjectId,
        ref: 'users'
    }],
    comments: [{
        type: Schema.Types.ObjectId,
        ref: 'comments'
    }],
    image: [{
        filename: {
            type: String
        },
        url: {
            type: String
        }
    }],
    video: {
        filename: {
            type: String
        },
        url: {
            type: String
        }
    },
    reports_post: [{
        type: Schema.Types.ObjectId,
        ref: 'reports_post'
    }]
});
module.exports = mongoose.model('posts', postSchema);
