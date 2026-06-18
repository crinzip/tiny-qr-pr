const Polynomial = require('./polynomial')

function ReedSolomonEncoder (degree) {
  this.genPoly = undefined
  this.degree = degree

  if (this.degree) this.initialize(this.degree)
}







ReedSolomonEncoder.prototype.initialize = function initialize (degree) {

  this.degree = degree
  this.genPoly = Polynomial.generateECPolynomial(this.degree)
}







ReedSolomonEncoder.prototype.encode = function encode (data) {
  if (!this.genPoly) {
    throw new Error('Encoder not initialized')
  }



  const paddedData = new Uint8Array(data.length + this.degree)
  paddedData.set(data)



  const remainder = Polynomial.mod(paddedData, this.genPoly)




  const start = this.degree - remainder.length
  if (start > 0) {
    const buff = new Uint8Array(this.degree)
    buff.set(remainder, start)

    return buff
  }

  return remainder
}

module.exports = ReedSolomonEncoder
