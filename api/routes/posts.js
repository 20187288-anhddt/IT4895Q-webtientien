const router = require('express').Router();
const User = require('../models/User');
const Post = require('../models/Post');
const Report_Post = require('../models/Report_Post');
const Comment = require('../models/Comment');
const verify = require('../utils/verifyToken');
const {getUserIDFromToken} = require('../utils/getUserIDFromToken');
var multer  = require('multer');
const { Storage } = require('@google-cloud/storage');
var {responseCode, setAndSendResponse} = require('../response/error');
const validInput = require('../utils/validInput');
const MAX_IMAGE_NUMBER = 4;
const MAX_SIZE_IMAGE = 4 * 1024 * 1024; // for 4MB
const MAX_VIDEO_NUMBER = 1;
const MAX_SIZE_VIDEO = 10 * 1024 * 1024; // for 10MB
const MAX_WORD_POST = 500;
const statusArray = ['hạnh phúc', 'có phúc', 'được yêu', 'buồn', 'đáng yêu', 'biết ơn', 'hào hứng', 'đang yêu', 'điên', 'cảm kích', 'sung sướng',
                    'tuyệt vời', 'ngốc nghếch', 'vui vẻ', 'tuyệt vời', 'thật phong cách', 'thú vị', 'thư giãn', 'positive', 'rùng mình',
                    'đầy hi vọng', 'hân hoan', 'mệt mỏi', 'có động lực', 'proud', 'chỉ có một mình', 'chu đáo', 'OK', 'nhớ nhà', 'giận dữ',
                    'ốm yếu', 'hài lòng', 'kiệt sức', 'xúc động', 'tự tin', 'rất tuyệt', 'tươi mới', 'quyết đoán', 'kiệt sức', 'bực mình',
                    'vui vẻ', 'gặp may', 'đau khổ', 'buồn tẻ', 'buồn ngủ', 'tràn đầy sinh lực', 'đói', 'chuyên nghiệp', 'đau đớn', 'thanh thản'
                    ];

const subjectArray = {
    'Ảnh khỏa thân': ['Ảnh khỏa thân người lớn', 'Gợi dục', 'Hoạt động tình dục', 'Bóc lột tình dục', 'Dịch vụ tình dục', 'Liên quan đến trẻ em', 'Chia sẻ hình ảnh riêng tư'],
    'Bạo lực': ['Hình ảnh bạo lực', 'Tử vong hoặc bị thương nặng', 'Mối đe dọa bạo lực', 'Ngược đãi động vật', 'Vấn đề khác'],
    'Quấy rối': ['Tôi', 'Một người bạn'],
    'Tự tử/Tự gây thương tích': 'Tự tử/Tự gây thương tích',
    'Tin giả': 'Tin giả',
    'Spam': 'Spam',
    'Bán hàng trái phép': ['Chất cấm, chất gây nghiện', 'Vũ khí', 'Động vật có nguy cơ bị tuyệt chủng', 'Động vật khác', 'Vấn đề khác'],
};

const categoryArray = ['0', '1'];

const uploader = multer({
    storage: multer.memoryStorage(),
});

function countWord(str) {
    return str.split(" ").length;
}

// API get_list_videos
router.post('/get_list_videos', async (req, res) => {
    var {token, index, count, last_id} = req.query;
    var data;
    if((index !== 0 && !index) || (count !== 0 && !count)) {
        console.log("No have parameter index, count");
        return setAndSendResponse(res, responseCode.PARAMETER_IS_NOT_ENOUGH);
    }

    if((index && typeof index !== "string") || (count && typeof count !== "string") || (last_id && typeof last_id !== "string")
        || (token && typeof token !== "string")) {
        console.log("PARAMETER_TYPE_IS_INVALID");
        return setAndSendResponse(res, responseCode.PARAMETER_TYPE_IS_INVALID);
    }

    if(!validInput.checkNumber(index) || !validInput.checkNumber(count)) {
        console.log("chỉ chứa kí tự số");
        return setAndSendResponse(res, responseCode.PARAMETER_VALUE_IS_INVALID);
    }

    index = parseInt(index, 10);
    count = parseInt(count, 10);
    if(isNaN(index) || isNaN(count)) {
        console.log("PARAMETER_VALUE_IS_INVALID");
        return setAndSendResponse(res, responseCode.PARAMETER_VALUE_IS_INVALID);
    }

    var user, posts;
    try {
        if(token) {
            user = await getUserIDFromToken(token);
            if(user && typeof user == "string") {
                return setAndSendResponse(res, responseCode[user]);
            }
        }
        posts = await Post.find({"video.url": { $ne: undefined }}).populate('author').sort("-created");
    } catch (err) {
        return setAndSendResponse(res, responseCode.CAN_NOT_CONNECT_TO_DB);
    }

    if(posts.length < 1) {
        console.log('Không có bài viết nào');
        return setAndSendResponse(res, responseCode.NO_DATA_OR_END_OF_LIST_DATA);
    }

    let index_last_id = posts.findIndex((element) => {return element._id == last_id});
    if(index_last_id == -1) {
        last_id = posts[0]._id;
        index_last_id = 0;
    }

    let slicePosts = posts.slice(index_last_id + index, index_last_id + index + count);

    if(slicePosts.length < 1) {
        console.log('Không có bài viết nào');
        return setAndSendResponse(res, responseCode.NO_DATA_OR_END_OF_LIST_DATA);
    }

    data = {
        post: slicePosts.map(post => {
            return {
                id: post._id,
                video: post.video.url ? {
                    url: post.video.url,
                    thumb: null
                }: null,
                described: post.described ? post.described: null,
                created: post.created.toString(),
                modified: post.modified.toString(),
                like: post.likedUser.length.toString(),
                comment: post.comments.length.toString(),
                is_liked: user ? (post.likedUser.includes(user._id) ? "1": "0") : "0",
                is_blocked: is_blocked(user, post.author),
                can_comment: "1",
                can_edit: can_edit(user, post.author),
                state: post.status ? post.status : null,
                author: post.author ? {
                    id: post.author._id,
                    username: post.author.name ? post.author.name : null,
                    avatar: post.author.avatar.url ? post.author.avatar.url: null
                } : null,
            }
        }),
        new_items: index_last_id.toString(),
        last_id: last_id
    }

    res.status(200).send({
                        code: "1000",
                        message: "OK",
                        data: data
                    });
});

// API get_list_posts
router.post('/get_list_posts', async (req, res) => {
    var {token, index, count, last_id} = req.query;
    var data;
    if((index !== 0 && !index) || (count !== 0 && !count)) {
        console.log("No have parameter index, count");
        return setAndSendResponse(res, responseCode.PARAMETER_IS_NOT_ENOUGH);
    }

    if((index && typeof index !== "string") || (count && typeof count !== "string") || (last_id && typeof last_id !== "string")
        || (token && typeof token !== "string")) {
        console.log("PARAMETER_TYPE_IS_INVALID");
        return setAndSendResponse(res, responseCode.PARAMETER_TYPE_IS_INVALID);
    }

    if(!validInput.checkNumber(index) || !validInput.checkNumber(count)) {
        console.log("chỉ chứa các kí tự số");
        return setAndSendResponse(res, responseCode.PARAMETER_VALUE_IS_INVALID);
    }

    index = parseInt(index, 10);
    count = parseInt(count, 10);
    if(isNaN(index) || isNaN(count)) {
        console.log("PARAMETER_VALUE_IS_INVALID");
        return setAndSendResponse(res, responseCode.PARAMETER_VALUE_IS_INVALID);
    }

    var user, posts;
    try {
        if(token) {
            user = await getUserIDFromToken(token);
            if(user && typeof user == "string") {
                return setAndSendResponse(res, responseCode[user]);
            }
        }
        posts = await Post.find().populate('author').sort("-created");
    } catch (err) {
        return setAndSendResponse(res, responseCode.CAN_NOT_CONNECT_TO_DB);
    }

    if(posts.length < 1) {
        console.log('Không có bài viết nào');
        return setAndSendResponse(res, responseCode.NO_DATA_OR_END_OF_LIST_DATA);
    }

    let index_last_id = posts.findIndex((element) => {return element._id == last_id});
    if(index_last_id == -1) {
        last_id = posts[0]._id;
        index_last_id = 0;
    }

    let slicePosts = posts.slice(index_last_id + index, index_last_id + index + count);

    if(slicePosts.length < 1) {
        console.log('Không có bài viết nào');
        return setAndSendResponse(res, responseCode.NO_DATA_OR_END_OF_LIST_DATA);
    }

    data = {
        posts: slicePosts.map(post => {
            return {
                id: post._id,
                image: post.image.length > 0 ? post.image.map(image => { return {id: image._id, url: image.url};}) : null,
                video: post.video.url ? {
                    url: post.video.url,
                    thumb: null
                }: null,
                described: post.described ? post.described : null,
                created: post.created.toString(),
                modified: post.modified.toString(),
                like: post.likedUser.length.toString(),
                comment: post.comments.length.toString(),
                is_liked: user ? (post.likedUser.includes(user._id) ? "1": "0") : "0",
                is_blocked: is_blocked(user, post.author),
                can_comment: "1",
                can_edit: can_edit(user, post.author),
                state: post.status ? post.status : null,
                author: post.author ? {
                    id: post.author._id,
                    username: post.author.name ? post.author.name : null,
                    avatar: post.author.avatar.url ? post.author.avatar.url: null
                } : null,
            }
        }),
        new_items: index_last_id.toString(),
        last_id: last_id
    }

    res.status(200).send({
                        code: "1000",
                        message: "OK",
                        data: data
                    });
});

// API get_post
router.post('/get_post', async (req, res) => {
    var {token, id} = req.query;
    var data;

    if(id !== 0 && !id) {
        console.log("No have parameter id");
        return setAndSendResponse(res, responseCode.PARAMETER_IS_NOT_ENOUGH);
    }

    if((id && typeof id !== "string") || (token && typeof token !== "string")) {
        console.log("PARAMETER_TYPE_IS_INVALID");
        return setAndSendResponse(res, responseCode.PARAMETER_TYPE_IS_INVALID);
    }

    var user;
    try {
        if(token) {
            user = await getUserIDFromToken(token);
            if(user && typeof user == "string") {
                return setAndSendResponse(res, responseCode[user]);
            }
        }
        const post = await Post.findById(id).populate('author');
        if(post) {
            res.status(200).send({
                code: "1000",
                message: "OK",
                data: {
                    id: post._id,
                    described: post.described ? post.described : null,
                    created: post.created.toString(),
                    modified: post.modified.toString(),
                    like: post.likedUser.length.toString(),
                    comment: post.comments.length.toString(),
                    is_liked: user ? (post.likedUser.includes(user._id) ? "1": "0") : "0",
                    image: post.image.length > 0 ? post.image.map(image => { return {id: image._id, url: image.url};}) : null,
                    video: post.video.url ? {
                        url: post.video.url,
                        thumb: null
                    } : null,
                    author: post.author ? {
                        id: post.author._id,
                        name: post.author.name ? post.author.name : null,
                        avatar: post.author.avatar.url ? post.author.avatar.url: null
                    } : null,
                    state: post.status ? post.status : null,
                    is_blocked: is_blocked(user, post.author),
                    can_edit: can_edit(user, post.author),
                    can_comment: "1"
                }
              });
        } else {
            return setAndSendResponse(res, responseCode.POST_IS_NOT_EXISTED);
        }
    } catch (err) {
        if(err.kind == "ObjectId") {
            console.log("Sai id");
            return setAndSendResponse(res, responseCode.POST_IS_NOT_EXISTED);
        }
        return setAndSendResponse(res, responseCode.CAN_NOT_CONNECT_TO_DB);
    }
});

function is_blocked(user, author) {
    if(user && author && author.blockedList && author.blockedList.findIndex((element) => {return element.user.toString() == user._id.toString()}) != -1) return "1";
    if(user && author && user.blockedList && user.blockedList.findIndex((element) => {return element.user.toString() == author._id.toString()}) != -1) return "1";
    return "0";
}

function can_edit(user, author) {
    if(user && author && (user._id.toString() == author._id.toString())) return "1";
    return "0";
}

function uploadFile(file) {
    const newNameFile = new Date().toISOString() + file.originalname;
    const blob = bucket.file(newNameFile);
    const blobStream = blob.createWriteStream({
        metadata: {
            contentType: file.mimetype,
        },
    });
    const publicUrl =
        `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURI(blob.name)}?alt=media`;
    return new Promise((resolve, reject) => {

        blobStream.on('error', function(err) {
            reject(err);
        });

        blobStream.on('finish', () => {
            resolve({
                filename: newNameFile,
                url: publicUrl
            });
          });

        blobStream.end(file.buffer);
    });
}


async function deleteRemoteFile(filename) {
    await bucket.file(filename).delete();
}

// API add_post
var cpUpload = uploader.fields([{ name: 'image'}, { name: 'video'}]);
router.post('/add_post', cpUpload, verify, async (req, res, next) => {
    var {described, status} = req.query;
    var image, video;
    if(req.files) {
        image = req.files.image;
        video = req.files.video;
    }
    var user = req.user;

    if(!described && !image && !video) {
        console.log("Khong co described, image, video");
        return setAndSendResponse(res, responseCode.PARAMETER_IS_NOT_ENOUGH);
    }

    if((described && typeof described !== "string") || (status && typeof status !== "string")) {
        console.log("PARAMETER_TYPE_IS_INVALID");
        return setAndSendResponse(res, responseCode.PARAMETER_TYPE_IS_INVALID);
    }

    if(described && countWord(described) > MAX_WORD_POST) {
        console.log("MAX_WORD_POST");
        return setAndSendResponse(res, responseCode.PARAMETER_VALUE_IS_INVALID);
    }

    if(status && !statusArray.includes(status)) {
        console.log("Sai status");
        return setAndSendResponse(res, responseCode.PARAMETER_VALUE_IS_INVALID);
    }

    if(image && video) {
        console.log("Have image and video");
        return setAndSendResponse(res, responseCode.UPLOAD_FILE_FAILED);
    }

    var now = Math.floor(Date.now() / 1000);
    var post = new Post({
        author: user.id,
        described: described,
        status: status,
        created: now,
        modified: now
    });

    let promises;

    if(image) {
        if(image.length > MAX_IMAGE_NUMBER) {
            console.log("MAXIMUM_NUMBER_OF_IMAGES");
            return setAndSendResponse(res, responseCode.MAXIMUM_NUMBER_OF_IMAGES);
        }

        for(const item_image of image) {
            const filetypes = /jpeg|jpg|png/;
            const mimetype = filetypes.test(item_image.mimetype);
            if(!mimetype) {
                console.log("Mimetype image is invalid");
                return setAndSendResponse(res, responseCode.PARAMETER_VALUE_IS_INVALID);
            }
            if (item_image.buffer.byteLength > MAX_SIZE_IMAGE) {
                console.log("FILE_SIZE_IS_TOO_BIG");
                return setAndSendResponse(res, responseCode.FILE_SIZE_IS_TOO_BIG);
            }
        }

        promises = image.map(item_image => {
            return uploadFile(item_image);
        });
        try {
            const file = await Promise.all(promises);
            post.image = file;
        } catch (err) {
            console.error(err);
            console.log("UPLOAD_FILE_FAILED");
            return setAndSendResponse(res, responseCode.UPLOAD_FILE_FAILED);
        }

    }

    if(video) {
        if(video.length > MAX_VIDEO_NUMBER) {
            console.log("MAX_VIDEO_NUMBER");
            return setAndSendResponse(res, responseCode.PARAMETER_VALUE_IS_INVALID);
        }

        for(const item_video of video) {
            const filetypes = /mp4/;
            const mimetype = filetypes.test(item_video.mimetype);
            if(!mimetype) {
                console.log("Mimetype video is invalid");
                return setAndSendResponse(res, responseCode.PARAMETER_VALUE_IS_INVALID);
            }

            if (item_video.buffer.byteLength > MAX_SIZE_VIDEO) {
                console.log("Max video file size");
                return setAndSendResponse(res, responseCode.FILE_SIZE_IS_TOO_BIG);
            }
        }

        promises = req.files.video.map(video => {
            return uploadFile(video);
        });
        try {
            const file = await Promise.all(promises);
            post.video = file[0];
        } catch (err) {
            console.log("UPLOAD_FILE_FAILED");
            return setAndSendResponse(res, responseCode.UPLOAD_FILE_FAILED);
        }


    }

    try {
        const savedPost = await post.save();
        return res.status(201).send({
            code: "1000",
            message: "OK",
            data: {
                id: savedPost._id,
                url: null
            }
        });
    } catch (err) {
        console.log("CAN_NOT_CONNECT_TO_DB");
        return setAndSendResponse(res, responseCode.CAN_NOT_CONNECT_TO_DB);
    }
});


// API delete_post
router.post('/delete_post', verify, async (req, res) => {
    var { id } = req.query;
    var user = req.user;

    if(id !== 0 && !id) {
        console.log("No have parameter id");
        return setAndSendResponse(res, responseCode.PARAMETER_IS_NOT_ENOUGH);
    }

    if((id && typeof id !== "string")) {
        console.log("PARAMETER_TYPE_IS_INVALID");
        return setAndSendResponse(res, responseCode.PARAMETER_TYPE_IS_INVALID);
    }

    let post;
    try {
        post = await Post.findById(id);
    } catch (err) {
        if(err.kind == "ObjectId") {
            console.log("Sai id");
            return setAndSendResponse(res, responseCode.POST_IS_NOT_EXISTED);
        }
        console.log("Không kết nối được DB");
        return setAndSendResponse(res, responseCode.CAN_NOT_CONNECT_TO_DB);
    }

    if (!post) {
        console.log("Post is not existed");
        return setAndSendResponse(res, responseCode.POST_IS_NOT_EXISTED);
    }

    if(post.author != user.id) {
        console.log("Not Access");
        return setAndSendResponse(res, responseCode.NOT_ACCESS);
    }

    if(post.image.length > 0) {
        for(let image of post.image) {
            try {
                await deleteRemoteFile(image.filename);
            } catch (err) {
                console.log("Không xóa được ảnh");
                return setAndSendResponse(res, responseCode.EXCEPTION_ERROR);
            }
        }
    }

    if(post.video.url) {
        try {
            await deleteRemoteFile(post.video.filename);
        } catch (err) {
            console.log("Không xóa được video");
            return setAndSendResponse(res, responseCode.EXCEPTION_ERROR);
        }
    }

    if(post.comments && post.comments.length > 0) {
        try {
            const deletedReportPost = await Comment.deleteMany({_id:{$in:post.comments}});
        } catch (err) {
            console.log("Không kết nối được DB");
            return setAndSendResponse(res, responseCode.CAN_NOT_CONNECT_TO_DB);
        }
    }

    try {
        const deletedPost = await Post.findByIdAndDelete(id);
        return res.status(200).send({
            code: "1000",
            message: "OK"
        });
    } catch (err) {
        if(err.kind == "ObjectId") {
            console.log("Sai id");
            return setAndSendResponse(res, responseCode.POST_IS_NOT_EXISTED);
        }
        console.log("Không kết nối được DB");
        return setAndSendResponse(res, responseCode.CAN_NOT_CONNECT_TO_DB);
    }
})


// API edit_post
router.post('/edit_post', cpUpload, verify, async (req, res) => {
    var { id, status, image_del, image_sort, described, auto_accept, auto_block } = req.query;
    var image, video;
    if(req.files) {
        image = req.files.image;
        video = req.files.video;
    }
    var user = req.user;

    if(image_del) {
        try {
            image_del = JSON.parse(image_del);
        } catch (err) {
            console.log("image_del parse loi PARAMETER_TYPE_IS_INVALID");
            return setAndSendResponse(res, responseCode.PARAMETER_VALUE_IS_INVALID);
        }
        if(!Array.isArray(image_del)) {
            console.log("image_del PARAMETER_TYPE_IS_INVALID");
            return setAndSendResponse(res, responseCode.PARAMETER_VALUE_IS_INVALID);
        }
        for(const id_image_del of image_del) {
            if(typeof id_image_del !== "string") {
                console.log("image_del element PARAMETER_TYPE_IS_INVALID");
                return setAndSendResponse(res, responseCode.PARAMETER_TYPE_IS_INVALID);
            }
        }
        image_del = image_del.filter((item, i, ar) => ar.indexOf(item) === i);
    } else {
        image_del = [];
    }

    if(id !== 0 && !id) {
        console.log("No have parameter id");
        return setAndSendResponse(res, responseCode.PARAMETER_IS_NOT_ENOUGH);
    }

    if((id && typeof id !== "string") || (described && typeof described !== "string") || (status && typeof status !== "string")) {
        console.log("PARAMETER_TYPE_IS_INVALID");
        return setAndSendResponse(res, responseCode.PARAMETER_TYPE_IS_INVALID);
    }

    if(described && countWord(described) > MAX_WORD_POST) {
        console.log("MAX_WORD_POST");
        return setAndSendResponse(res, responseCode.PARAMETER_VALUE_IS_INVALID);
    }

    if(status && !statusArray.includes(status)) {
        console.log("Sai status");
        return setAndSendResponse(res, responseCode.PARAMETER_VALUE_IS_INVALID);
    }

    if(image && video) {
        console.log("Have image and video gui di");
        return setAndSendResponse(res, responseCode.UPLOAD_FILE_FAILED);
    }

    let post;
    try {
        post = await Post.findById(id);
    } catch (err) {
        if(err.kind == "ObjectId") {
            console.log("Sai id");
            return setAndSendResponse(res, responseCode.POST_IS_NOT_EXISTED);
        }
        console.log("Không kết nối được DB");
        return setAndSendResponse(res, responseCode.CAN_NOT_CONNECT_TO_DB);
    }

    if (!post) {
        console.log("Post is not existed");
        return setAndSendResponse(res, responseCode.POST_IS_NOT_EXISTED);
    }

    if(post.author != user.id) {
        console.log("Not Access");
        return setAndSendResponse(res, responseCode.NOT_ACCESS);
    }

    if(image_del && image_del.length > 0) {
        for(const id_image_del of image_del) {
            let isInvalid = true;
            for(const image of post.image) {
                if(image.id == id_image_del) {
                    isInvalid = false;
                }
            }
            if(isInvalid) {
                console.log("Sai id");
                return setAndSendResponse(res, responseCode.PARAMETER_VALUE_IS_INVALID);
            }
        }

        // Xoa anh
        for(const id_image_del of image_del) {
            console.log("xoa anh");
            var i;
            for(i=0; i < post.image.length; i++) {
                if(post.image[i]._id == id_image_del) {
                    break;
                }
            }
            try {
                await deleteRemoteFile(post.image[i].filename);
            } catch (err) {
                return setAndSendResponse(res, responseCode.UNKNOWN_ERROR);
            }
            post.image.splice(i, 1);
        }
    }

    let promises, file;

    if(video && !image) {
        if(post.image.length != 0) {
            console.log("Have image and video up video");
            return setAndSendResponse(res, responseCode.UPLOAD_FILE_FAILED);
        }

        if(video.length > MAX_VIDEO_NUMBER) {
            console.log("MAX_VIDEO_NUMBER");
            return setAndSendResponse(res, responseCode.PARAMETER_VALUE_IS_INVALID);
        }

        for(const item_video of video) {
            const filetypes = /mp4/;
            const mimetype = filetypes.test(item_video.mimetype);
            if(!mimetype) {
                console.log("Mimetype video is invalid");
                return setAndSendResponse(res, responseCode.PARAMETER_VALUE_IS_INVALID);
            }

            if (item_video.buffer.byteLength > MAX_SIZE_VIDEO) {
                console.log("Max video file size");
                return setAndSendResponse(res, responseCode.FILE_SIZE_IS_TOO_BIG);
            }
        }

        promises = video.map(video => {
            return uploadFile(video);
        });

        try {
            if(post.video.url) {
                await deleteRemoteFile(post.video.filename);
            }
        } catch (err) {
            return setAndSendResponse(res, responseCode.UNKNOWN_ERROR);
        }

        try {
            file = await Promise.all(promises);
            post.video = file[0];
        } catch (err) {
            console.log("Upload fail");
            return setAndSendResponse(res, responseCode.UPLOAD_FILE_FAILED);
        }
    }

    if(image && !video) {
        if(post.video.url) {
            console.log("Have image and video up anh");
            return setAndSendResponse(res, responseCode.UPLOAD_FILE_FAILED);
        }

        for(const item_image of image) {
            const filetypes = /jpeg|jpg|png/;
            const mimetype = filetypes.test(item_image.mimetype);
            if(!mimetype) {
                console.log("Mimetype image is invalid");
                return setAndSendResponse(res, responseCode.PARAMETER_VALUE_IS_INVALID);
            }

            if (item_image.buffer.byteLength > MAX_SIZE_IMAGE) {
                console.log("Max image file size");
                return setAndSendResponse(res, responseCode.FILE_SIZE_IS_TOO_BIG);
            }
        }

        if(image.length + post.image.length > MAX_IMAGE_NUMBER) {
            console.log("Max image number");
            return setAndSendResponse(res, responseCode.MAXIMUM_NUMBER_OF_IMAGES);
        }

        promises = image.map(item_image => {
            return uploadFile(item_image);
        });

        try {
            file = await Promise.all(promises);
            for(let file_item of file) {
                post.image.push(file_item);
            }
        } catch (err) {
            console.log("Upload fail");
            return setAndSendResponse(res, responseCode.UPLOAD_FILE_FAILED);
        }
    }

    if(described) {
        console.log("Have described");
        if(countWord(described) > MAX_WORD_POST) {
            console.log("MAX_WORD_POST");
            return setAndSendResponse(res, responseCode.PARAMETER_VALUE_IS_INVALID);
        }
        post.described = described;
    }

    if(status) {
        console.log("Have status");
        post.status = status;
    }

    try {
        post.modified = Math.floor(Date.now() / 1000);
        const savedPost = await post.save();
        return res.status(200).send({
            code: "1000",
            message: "OK"
        });
    } catch (err) {
        console.log("Edit fail");
        return setAndSendResponse(res, responseCode.CAN_NOT_CONNECT_TO_DB);
    }
})

// API report_post
router.post('/report_post', verify, async (req, res) => {
    var {id, subject, details} = req.query;
    var user = req.user;

    if(!id || !subject || !details) {
        console.log("No have parameter id, subject, details");
        return setAndSendResponse(res, responseCode.PARAMETER_IS_NOT_ENOUGH);
    }

    if((id && typeof id !== "string") || (subject && typeof subject !== "string") || (details && typeof details !== "string")) {
        console.log("PARAMETER_TYPE_IS_INVALID");
        return setAndSendResponse(res, responseCode.PARAMETER_TYPE_IS_INVALID);
    }

    if(!subjectArray[subject] || !subjectArray[subject].includes(details)) {
        console.log("PARAMETER_VALUE_IS_INVALID");
        return setAndSendResponse(res, responseCode.PARAMETER_VALUE_IS_INVALID);
    }

    let post;
    try {
        post = await Post.findById(id);
    } catch (err) {
        if(err.kind == "ObjectId") {
            console.log("Sai id");
            return setAndSendResponse(res, responseCode.POST_IS_NOT_EXISTED);
        }
        console.log("Không kết nối được DB");
        return setAndSendResponse(res, responseCode.CAN_NOT_CONNECT_TO_DB);
    }

    if (!post) {
        console.log("Bài viết không tồn tại!");
        return setAndSendResponse(res, responseCode.POST_IS_NOT_EXISTED);
    }

    if(post.author == user.id) {
        console.log("Không thể báo cáo bài viết của chính mình ");
        return setAndSendResponse(res, responseCode.UNKNOWN_ERROR);
    }

    const reportPost = new Report_Post({
        post: id,
        subject: subject,
        details: details,
        reporter: user.id
    });

    try {
        const savedReportPost = await reportPost.save();
        if(!post.reports_post) {
            post.reports_post = [savedReportPost._id];
        } else {
            post.reports_post.push(savedReportPost._id);
        }
        const savedPost = await post.save();
        return res.status(200).send({
            code: "1000",
            message: "OK"
        });
    } catch (err) {
        console.log(err);
        console.log("Không kết nối được DB");
        return setAndSendResponse(res, responseCode.CAN_NOT_CONNECT_TO_DB);
    }
})

// API check_new_item
router.post('/check_new_item', async (req, res) => {
    var {last_id, category_id} = req.query;
    var data;
    if(last_id !== 0 && !last_id) {
        console.log("No have parameter last_id");
        return setAndSendResponse(res, responseCode.PARAMETER_IS_NOT_ENOUGH);
    }

    if((last_id && typeof last_id !== "string") || (category_id && typeof category_id !== "string")) {
        console.log("PARAMETER_TYPE_IS_INVALID");
        return setAndSendResponse(res, responseCode.PARAMETER_TYPE_IS_INVALID);
    }

    if(category_id && !categoryArray.includes(category_id)) {
        console.log("PARAMETER_VALUE_IS_INVALID");
        return setAndSendResponse(res, responseCode.PARAMETER_VALUE_IS_INVALID);
    }

    if(!category_id) {
        category_id = '0';
    }

    var posts;

    try {
        if(category_id == '0') {
            posts = await Post.find().sort("-created");
        } else if (category_id == '1') {
            posts = await Post.find({"video.url": { $ne: undefined }}).sort("-created");
        }
    } catch (err) {
        return setAndSendResponse(res, responseCode.CAN_NOT_CONNECT_TO_DB);
    }

    if(posts.length < 1) {
        console.log('Không có bài viết nào');
        return res.status(200).send({
            code: "1000",
            message: "OK",
            data: {
                new_items: "0"
            }
        });
    }

    let index_last_id = posts.findIndex((element) => {return element._id == last_id});
    if(index_last_id == -1) {
        last_id = posts[0]._id;
        index_last_id = 0;
    }

    res.status(200).send({
                        code: "1000",
                        message: "OK",
                        data: {
                            new_items: index_last_id.toString()
                        }
                    });
});

module.exports = router;
