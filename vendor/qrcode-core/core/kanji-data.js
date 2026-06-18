const Mode = require('./mode')
const Utils = require('./utils')

function KanjiData (data) {
  this.mode = Mode.KANJI
  this.data = data
}

KanjiData.getBitsLength = function getBitsLength (length) {
  return length * 13
}

KanjiData.prototype.getLength = function getLength () {
  return this.data.length
}

KanjiData.prototype.getBitsLength = function getBitsLength () {
  return KanjiData.getBitsLength(this.data.length)
}

KanjiData.prototype.write = function (bitBuffer) {
  let i




  for (i = 0; i < this.data.length; i++) {
    let value = Utils.toSJIS(this.data[i])


    if (value >= 0x8140 && value <= 0x9FFC) {

      value -= 0x8140


    } else if (value >= 0xE040 && value <= 0xEBBF) {

      value -= 0xC140
    } else {
      throw new Error(
        'Invalid SJIS character: ' + this.data[i] + '\n' +
        'Make sure your charset is UTF-8')
    }



    value = (((value >>> 8) & 0xff) * 0xC0) + (value & 0xff)


    bitBuffer.put(value, 13)
  }
}

module.exports = KanjiData
