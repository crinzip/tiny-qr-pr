const getSymbolSize = require('./utils').getSymbolSize
const FINDER_PATTERN_SIZE = 7








exports.getPositions = function getPositions (version) {
  const size = getSymbolSize(version)

  return [

    [0, 0],

    [size - FINDER_PATTERN_SIZE, 0],

    [0, size - FINDER_PATTERN_SIZE]
  ]
}
