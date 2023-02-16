const removeAccents = require('./removeAccents');

var checkUserPassword = (password) => {
    var regex = /^[A-Za-z\d]{6,10}$/;
    return regex.test(password);
}
var checkPhoneNumber = (phoneNumber) => {
    var regex = /^0[0-9]{9}$/;
    return regex.test(phoneNumber);
}
const checkIsInteger = x => {
  let parsed = parseInt(x, 10);
  if (isNaN(parsed)) return false;
  if (Number.isInteger(parsed)) return true;
  else return false;
}
var checkVerifyCode = (verifyCode) => {
  var regex = /^[1-9][0-9]{3}$/;
  return regex.test(verifyCode);
}
var checkUserName = (userName) => {
  return new Promise((resolve, reject) => {
    if (userName.length == 0) reject('lỗi xâu rỗng');
    let str = removeAccents(userName);
    var regex = /^[a-zA-Z][a-zA-Z_ ]*$/;
    if (regex.test(str)) resolve(userName);
    else reject('Phải bắt đầu là chữ, tiếp theo là chữ hoặc gạch dưới hoặc khoảng trắng')
  })
}
var checkLink = link => {
  let banLink = ['facebook.com', 'google.com', 'youtube.com', 'phimmoi.net', 'hdonline.vn', 'phimbathu.com'];
  let result = banLink.filter(e => link.includes(e));
  if (result.length > 0) return false;
  else return true;
}
var checkNumber = (number) => {
  var regex = /^[0-9]*$/;
  return regex.test(number);
}
module.exports = { checkUserPassword, checkPhoneNumber, checkIsInteger, checkVerifyCode, checkUserName, checkLink, checkNumber};