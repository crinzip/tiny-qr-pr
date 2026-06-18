const EXP_TABLE = new Uint8Array(512)
const LOG_TABLE = new Uint8Array(256)








;(function initTables () {
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = x
    LOG_TABLE[x] = i

    x <<= 1



    if (x & 0x100) {
      x ^= 0x11D
    }
  }





  for (let i = 255; i < 512; i++) {
    EXP_TABLE[i] = EXP_TABLE[i - 255]
  }
}())







exports.log = function log (n) {
  if (n < 1) throw new Error('log(' + n + ')')
  return LOG_TABLE[n]
}







exports.exp = function exp (n) {
  return EXP_TABLE[n]
}








exports.mul = function mul (x, y) {
  if (x === 0 || y === 0) return 0



  return EXP_TABLE[LOG_TABLE[x] + LOG_TABLE[y]]
}
