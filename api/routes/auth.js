const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const validInput = require("../utils/validInput");
const verify = require("../utils/verifyToken");
// const convertString = require("../utils/convertString");
const { responseCode, callRes } = require("../response/error");
// const checkInput = require("../utils/validInput");
// const validTime = require("../utils/validTime");
const removeAccents = require("../utils/removeAccents");

var multer = require("multer");
const { Storage } = require("@google-cloud/storage");
const MAX_IMAGE_NUMBER = 4;
const MAX_SIZE_IMAGE = 4 * 1024 * 1024; // for 4MB

const uploader = multer({
  storage: multer.memoryStorage(),
});

const User = require("../models/User");
const Setting = require("../models/Setting");
const verifyToken = require("../utils/verifyToken");
const LCS = require("../utils/LCS");

// API signup
router.post("/signup", async (req, res) => {
  const { password } = req.query;
  let phoneNumber = req.query.phoneNumber;
  if (phoneNumber === undefined || password === undefined) {
    return callRes(
      res,
      responseCode.PARAMETER_IS_NOT_ENOUGH,
      "phoneNumber, password"
    );
  }
  if (typeof phoneNumber != "string" || typeof password != "string") {
    return callRes(
      res,
      responseCode.PARAMETER_TYPE_IS_INVALID,
      "phoneNumber, password"
    );
  }
  if (!validInput.checkPhoneNumber(phoneNumber)) {
    return callRes(
      res,
      responseCode.PARAMETER_VALUE_IS_INVALID,"phoneNumber");
  }
  if (!validInput.checkUserPassword(password)) {
    return callRes(res, responseCode.PARAMETER_VALUE_IS_INVALID, "password");
  }
  if (phoneNumber == password) {
    return callRes(
      res,
      responseCode.PARAMETER_VALUE_IS_INVALID,"trùng phone và pass");
  }
  try {
    let user = await User.findOne({ phoneNumber });
    if (user) return callRes(res, responseCode.USER_EXISTED);
    const newUser = new User({
      phoneNumber,
      password,
      verifyCode: random4digit(),
      isVerified: true,
    });
    // hash password
    bcrypt.genSalt(10, (err, salt) => {
      if (err) return callRes(res, responseCode.UNKNOWN_ERROR, err.message);
      bcrypt.hash(newUser.password, salt, async (err, hash) => {
        if (err) return callRes(res, responseCode.UNKNOWN_ERROR, err.message);
        newUser.password = hash;
        try {
          let saved = await newUser.save();
          await new Setting({
            user: saved.id,
          }).save();
          let data = {
            id: saved.id,
            phoneNumber: saved.phoneNumber,
            verifyCode: saved.verifyCode,
            isVerified: saved.isVerified,
          };
          return callRes(res, responseCode.OK, data);
        } catch (error) {
          return callRes(
            res,
            responseCode.CAN_NOT_CONNECT_TO_DB,
            error.message
          );
        }
      });
    });
  } catch (error) {
    return callRes(res, responseCode.UNKNOWN_ERROR, error.message);
  }
});

// API login
router.post("/login", async (req, res) => {
  const { password } = req.query;
  let phoneNumber = req.query.phoneNumber;
  if (phoneNumber === undefined || password === undefined) {
    return callRes(
      res,
      responseCode.PARAMETER_IS_NOT_ENOUGH,"phoneNumber, password"
    );
  }
  if (typeof phoneNumber != "string" || typeof password != "string") {
    return callRes(
      res,
      responseCode.PARAMETER_TYPE_IS_INVALID,"phoneNumber, password"
    );
  }
  if (!validInput.checkPhoneNumber(phoneNumber)) {
    return callRes(
      res,
      responseCode.PARAMETER_VALUE_IS_INVALID,"phoneNumber"
    );
  }
  if (!validInput.checkUserPassword(password)) {
    return callRes(res, responseCode.PARAMETER_VALUE_IS_INVALID, "password");
  }
  if (phoneNumber == password) {
    return callRes(
      res,
      responseCode.PARAMETER_VALUE_IS_INVALID,"trùng phone và pass"
    );
  }
  try {
    // check for existing user
    let user = await User.findOne({ phoneNumber });
    if (!user)
      return callRes(
        res,
        responseCode.USER_IS_NOT_VALIDATED,
        "không có user này"
      );
    if (!user.isVerified)
      return callRes(
        res,
        responseCode.USER_IS_NOT_VALIDATED,
        "chưa xác thực code verify"
      );
    bcrypt.compare(password, user.password).then(async (isMatch) => {
      if (!isMatch)
        return callRes(
          res,
          responseCode.PARAMETER_VALUE_IS_INVALID,
          "password"
        );
      user.dateLogin = Date.now();
      try {
        let loginUser = await user.save();
        jwt.sign(
          { id: loginUser.id, dateLogin: loginUser.dateLogin },
          process.env.jwtSecret,
          { expiresIn: 86400 },
          (err, token) => {
            if (err)
              return callRes(res, responseCode.UNKNOWN_ERROR, err.message);
            let data = {
              id: loginUser.id,
              username: loginUser.name ? loginUser.name : null,
              token: token,
              avatar: loginUser.avatar.url ? loginUser.avatar.url : null,
              active: null,
            };
            return callRes(res, responseCode.OK, data);
          }
        );
      } catch (error) {
        return callRes(res, responseCode.UNKNOWN_ERROR, error.message);
      }
    });
  } catch (error) {
    return callRes(res, responseCode.UNKNOWN_ERROR, error.message);
  }
});

// API get_verify_code
router.post("/get_verify_code", async (req, res) => {
  const { phonenumber } = req.query;
  if (!phonenumber) {
    console.log("PARAMETER_IS_NOT_ENOUGH");
    return callRes(res, responseCode.PARAMETER_IS_NOT_ENOUGH, "phonenumber");
  }
  if (phonenumber && typeof phonenumber != "string") {
    return callRes(res, responseCode.PARAMETER_TYPE_IS_INVALID, "phonenumber");
  }
  if (!validInput.checkPhoneNumber(phonenumber)) {
    return callRes(
      res,
      responseCode.PARAMETER_VALUE_IS_INVALID,
      "phonenumber"
    );
  }

  try {
    let user = await User.findOne({ phoneNumber: phonenumber });
    if (!user) {
      console.log("phonenumber không tồn tại");
      return callRes(
        res,
        responseCode.USER_IS_NOT_VALIDATED,
        "phonenumber không tồn tại"
      );
    }
    if (user.isVerified) {
      console.log("user is verified");
      return callRes(
        res,
        responseCode.ACTION_HAS_BEEN_DONE_PREVIOUSLY_BY_THIS_USER,
        "user đã xác minh"
      );
    }

    if (user.timeLastRequestGetVerifyCode) {
      let time = (Date.now() - user.timeLastRequestGetVerifyCode) / 1000;
      console.log(time);
      if (time < 120) {
        console.log("2 lan lay verify gan nhau < 120s");
        return callRes(
          res,
          responseCode.ACTION_HAS_BEEN_DONE_PREVIOUSLY_BY_THIS_USER,
          "Await " + (120 - time) + "s"
        );
      }
    }

    user.timeLastRequestGetVerifyCode = Date.now();
    await user.save();

    let data = {
      verifyCode: user.verifyCode,
    };
    return callRes(res, responseCode.OK, data);
  } catch (err) {
    console.log(err);
    console.log("Không thể kết nối tới DB");
    return callRes(res, responseCode.CAN_NOT_CONNECT_TO_DB);
  }
});

// API logout
router.post("/logout", verify, async (req, res) => {
  try {
    let user = await User.findById(req.user.id);
    user.dateLogin = "";
    await user.save();
    return callRes(res, responseCode.OK);
  } catch (error) {
    return callRes(res, responseCode.UNKNOWN_ERROR, error.message);
  }
});

// API check_verify_code
router.post("/check_verify_code", async (req, res) => {
  const { phonenumber, code_verify } = req.query;

  if (!phonenumber || !code_verify) {
    return callRes(
      res,
      responseCode.PARAMETER_IS_NOT_ENOUGH,
      "phonenumber, code_verify"
    );
  }
  if (typeof phonenumber != "string" || typeof code_verify != "string") {
    return callRes(
      res,
      responseCode.PARAMETER_TYPE_IS_INVALID,
      "phonenumber, code_verify"
    );
  }
  if (!validInput.checkPhoneNumber(phonenumber)) {
    return callRes(
      res,
      responseCode.PARAMETER_VALUE_IS_INVALID,
      "phonenumber"
    );
  }
  if (!validInput.checkVerifyCode(code_verify)) {
    return callRes(
      res,
      responseCode.PARAMETER_VALUE_IS_INVALID,
      "code_verify"
    );
  }

  try {
    let user = await User.findOne({ phoneNumber: phonenumber });
    if (!user) {
      console.log("Số điện thoại không tồn tại");
      return callRes(
        res,
        responseCode.PARAMETER_VALUE_IS_INVALID,
        "Số điện thoại không tồn tại"
      );
    }

    if (user.isVerified) {
      console.log("user is verified");
      return callRes(
        res,
        responseCode.PARAMETER_VALUE_IS_INVALID,
        "User đã được xác minh "
      );
    }

    if (user.verifyCode != code_verify) {
      console.log("code_verify sai");
      return callRes(
        res,
        responseCode.PARAMETER_VALUE_IS_INVALID,
        "code_verify không đúng"
      );
    }

    user.isVerified = true;
    user.verifyCode = undefined;
    user.dateLogin = Date.now();
    let loginUser = await user.save();

    try {
      var token = jwt.sign(
        { id: loginUser.id, dateLogin: loginUser.dateLogin },
        process.env.jwtSecret,
        { expiresIn: 86400 }
      );
      let data = {
        token: token,
        id: user._id,
        active: null,
      };
      return callRes(res, responseCode.OK, data);
    } catch (err) {
      console.log(err);
      return callRes(res, responseCode.UNKNOWN_ERROR, err.message);
    }
  } catch (err) {
    console.log(err);
    console.log("CAN_NOT_CONNECT_TO_DB");
    return callRes(res, responseCode.CAN_NOT_CONNECT_TO_DB);
  }
});

//API change_password
router.post("/change_password", verifyToken, async (req, res) => {
  const { token, password, new_password } = req.query;

  if (!password || !new_password) {
    return callRes(
      res,
      responseCode.PARAMETER_IS_NOT_ENOUGH,"password, new_password"
    );
  }
  if (typeof password != "string" || typeof new_password != "string") {
    return callRes(
      res,
      responseCode.PARAMETER_TYPE_IS_INVALID,"password, new_password"
    );
  }
  if (!validInput.checkUserPassword(password)) {
    return callRes(res, responseCode.PARAMETER_VALUE_IS_INVALID, "password");
  }
  if (!validInput.checkUserPassword(new_password)) {
    return callRes(
      res,
      responseCode.PARAMETER_VALUE_IS_INVALID,
      "new_password"
    );
  }

  if (password == new_password) {
    return callRes(
      res,
      responseCode.PARAMETER_VALUE_IS_INVALID,
      "new_password == password"
    );
  }

  let user;
  try {
    user = await User.findById(req.user.id);
  } catch (err) {
    console.log("Không thể kết nối tới DB");
    return setAndSendResponse(res, responseCode.CAN_NOT_CONNECT_TO_DB);
  }

  var isPassword = bcrypt.compareSync(password, user.password);
  if (!isPassword) {
    return callRes(
      res,
      responseCode.PARAMETER_VALUE_IS_INVALID,
      "password khong dung"
    );
  }

  //hash password
  bcrypt.genSalt(10, (err, salt) => {
    if (err) return callRes(res, responseCode.UNKNOWN_ERROR, err.message);
    bcrypt.hash(new_password, salt, async (err, hash) => {
      if (err) return callRes(res, responseCode.UNKNOWN_ERROR, err.message);
      user.password = hash;
      try {
        user.dateLogin = undefined;
        let saved = await user.save();
        return callRes(res, responseCode.OK, null);
      } catch (error) {
        return callRes(res, responseCode.CAN_NOT_CONNECT_TO_DB, error.message);
      }
    });
  });
});

// API set_devtoken
router.post("/set_devtoken", verify, async (req, res) => {
  var { token, devtype, devtoken } = req.query;
  if (token === undefined || devtype === undefined || devtoken === undefined)
    return callRes(
      res,
      responseCode.PARAMETER_IS_NOT_ENOUGH,
      "token và devtype và devtoken"
    );
  let id = req.user.id;
  let thisUser = await User.findById(id);
  if (thisUser.isBlocked) {
    return callRes(
      res,
      responseCode.USER_IS_NOT_VALIDATED,
      "Tài khoản của bạn đã bị khóa"
    );
  }
  if (devtype != 0 && devtype != 1)
    return callRes(res, responseCode.PARAMETER_VALUE_IS_INVALID, "devtype");
  else return callRes(res, responseCode.OK);
});

// API change_info_after_signup
router.post(
  "/change_info_after_signup",
  verify,
  uploader.single("avatar"),
  async (req, res) => {
    let code, message;
    if (req.query.username === undefined) {
      return callRes(res, responseCode.PARAMETER_IS_NOT_ENOUGH, "username");
    }
    if (req.query.username.length == 0) {
      return callRes(res, responseCode.PARAMETER_VALUE_IS_INVALID, "username");
    }
    let str = removeAccents(req.query.username);
    var regex = /^[a-zA-Z][a-zA-Z_ ]*$/;
    if (!regex.test(str)) {
      return callRes(res, responseCode.PARAMETER_VALUE_IS_INVALID, "username");
    }
    if (str.length <= 3) {
      return callRes(
        res,
        responseCode.PARAMETER_VALUE_IS_INVALID,
        "Username quá ngắn"
      );
    }
    if (str.length >= 30) {
      return callRes(
        res,
        responseCode.PARAMETER_VALUE_IS_INVALID,
        "Username quá dài"
      );
    }

    if (req.file) {
      if (req.file.size > MAX_SIZE_IMAGE) {
        return callRes(res, responseCode.FILE_SIZE_IS_TOO_BIG);
      }
      if (
        req.file.mimetype != "image/jpeg" &&
        req.file.mimetype != "image/jpg" &&
        req.file.mimetype != "image/png"
      ) {
        return callRes(
          res,
          responseCode.PARAMETER_VALUE_IS_INVALID,
          "image type"
        );
      }
      let id = req.user.id;
      var user = await User.findById(id);

      if (user.name !== undefined) {
        return callRes(
          res,
          responseCode.ACTION_HAS_BEEN_DONE_PREVIOUSLY_BY_THIS_USER
        );
      }

      user.name = req.query.username;
      let promise = await uploadFile(req.file);
      user.avatar = promise;
      user.save();
      let data = {
        code: "1000",
        message: "OK",
        data: {
          id: user.id,
          username: user.name,
          phonenumber: user.phoneNumber,
          created: String(Math.floor(user.registerDate / 1000)),
          avatar: user.avatar.url,
        },
      };
      res.json({ code, message, data });
      return;
    } else {
      let id = req.user.id;
      var user = await User.findById(id);

      if (user.name !== undefined) {
        return callRes(
          res,
          responseCode.ACTION_HAS_BEEN_DONE_PREVIOUSLY_BY_THIS_USER
        );
      }

      user.name = req.query.username;
      user.save();
      let data = {
        code: "1000",
        message: "OK",
        data: {
          id: user.id,
          username: user.name,
          phonenumber: user.phoneNumber,
          created: String(Math.floor(user.registerDate / 1000)),
          avatar: null,
        },
      };
      res.json({ code, message, data });
      return;
    }
  }
);

//API check_new_version
router.post("/check_new_version", verify, async (req, res) => {
  var { token, last_update } = req.query;
  if (token === undefined || last_update === undefined)
    return callRes(
      res,
      responseCode.PARAMETER_IS_NOT_ENOUGH,
      "token và last_update"
    );
  let id = req.user.id;
  let thisUser = await User.findById(id);
  if (thisUser.isBlocked) {
    return callRes(
      res,
      responseCode.USER_IS_NOT_VALIDATED,
      "Tài khoản đã bị khóa"
    );
  }
  if (last_update != currentVersion) {
    data = {
      version: currentVersion,
      required: 1,
      url: "updateversion.com",
    };
    return callRes(res, responseCode.OK, data);
  } else {
    data = {
      version: currentVersion,
      required: 0,
    };
    return callRes(res, responseCode.OK, data);
  }
});

var currentVersion = "1.0";

function uploadFile(file) {
  const newNameFile = new Date().toISOString() + file.originalname;
  const blob = bucket.file(newNameFile);
  const blobStream = blob.createWriteStream({
    metadata: {
      contentType: file.mimetype,
    },
  });
  const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${
    bucket.name
  }/o/${encodeURI(blob.name)}?alt=media`;
  return new Promise((resolve, reject) => {
    blobStream.on("error", function (err) {
      reject(err);
    });

    blobStream.on("finish", () => {
      resolve({
        filename: newNameFile,
        url: publicUrl,
      });
    });

    blobStream.end(file.buffer);
  });
}

function random4digit() {
  return Math.floor(Math.random() * 9000) + 1000;
}

module.exports = router;
