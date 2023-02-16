const router = require('express').Router();
const Setting = require('../models/Setting');
const verify = require('../utils/verifyToken');
const { ObjectId } = require('mongodb');
const {responseCode, callRes, setAndSendResponse} = require('../response/error');


// API get_push_settings
router.post('/get_push_settings', verify, (req, res) => {
    Setting.findOne(
        { "user": ObjectId(req.user.id) },
        (err, setting) => {
            if (err) return callRes(res, responseCode.UNKNOWN_ERROR);
            else {
                const {like_comment, from_friends, requested_friend, suggested_friend,
                    birthday, video, report, sound_on, notification_on, vibrant_on, led_on} = setting
                return callRes(res, responseCode.OK, {
                    like_comment, from_friends, requested_friend, suggested_friend,
                    birthday, video, report, sound_on, notification_on, vibrant_on, led_on
                }) 
            }
        }
    )
})


// API set_push_settings
router.post('/set_push_settings', verify, (req, res) => {

    const update = {}
    const checkParamInvalid = (map_params) => {
        var isEnough=false;
        for (const [ key, value ] of Object.entries(map_params)) {
            if (value=="0" || value=="1") {
                isEnough=true
                update[key] = value
            }
            else if (value){
                callRes(res, responseCode.PARAMETER_VALUE_IS_INVALID);
                return 1
            } 
            
        }
        if (!isEnough) {
            callRes(res, responseCode.PARAMETER_IS_NOT_ENOUGH)
            return 1
        }

        return 0
    }

    const { like_comment, from_friends, requested_friend, suggested_friend,
            birthday, video, report, sound_on, notification_on, vibrant_on, led_on } = req.query;
    
    const map_params = { like_comment, from_friends, requested_friend, suggested_friend,
        birthday, video, report, sound_on, notification_on, vibrant_on, led_on }
    
    if (checkParamInvalid(map_params)) return;
    Setting.findOneAndUpdate(
        { "user": ObjectId(req.user.id) },
        update,
        {new: true},
        (err, setting) => {
            if (err) {
                return callRes(res, responseCode.UNKNOWN_ERROR)
            }else{
                const { like_comment, from_friends, requested_friend, suggested_friend,
                    birthday, video, report, sound_on, notification_on, vibrant_on, led_on } = setting
                    console.log(setting)
                return callRes(res, responseCode.OK, {
                    like_comment, from_friends, requested_friend, suggested_friend,
                    birthday, video, report, sound_on, notification_on, vibrant_on, led_on
                })
            }
        }
    )
})

module.exports = router;