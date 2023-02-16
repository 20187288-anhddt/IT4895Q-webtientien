require('dotenv').config()
const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors');
const multer = require('multer');
const {responseError, callRes} = require('./response/error');

const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: false }));
app.use(cors());

// connect to MongoDB
const url = process.env.mongoURI;
mongoose.connect(url,
    { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true })
    .then(() => console.log("Connect MongoDB thành công"))
    .catch(err => console.log(`errors: ${err}`)
    );

// use Routes
app.use('/webtientien/auth', require('./routes/auth'));
app.use('/webtientien/friend', require('./routes/friend'));
app.use('/webtientien/post', require('./routes/posts'));
app.use('/webtientien/search', require('./routes/search'));
app.use('/webtientien/comment', require('./routes/comments'));
app.use('/webtientien/like', require('./routes/likes'));
app.use('/webtientien/setting', require('./routes/settings'));
app.use('/webtientien/user', require('./routes/user'));

app.use(function (err, req, res, next) {
    if(err instanceof multer.MulterError) {
        if(err.code === 'LIMIT_UNEXPECTED_FILE') {
            return callRes(res, responseError.EXCEPTION_ERROR, "'" + err.field + "'" + " không đúng với mong đợi. Xem lại trường ảnh hoặc video gửi lên trong yêu cầu cho đúng");
        }
    }
    console.log(err);
    return callRes(res, responseError.UNKNOWN_ERROR, "Unknown Error");
})

const port = process.env.PORT || 6000;
app.listen(port, () => console.log(`Server chạy cổng ${port}`))
