// The pose of a tile in the fan of posters. Pure maths (no DOM), so the tests can import it.
//
// The pose depends on the tile's distance d from the middle of the row, measured in tiles, so ten tiles work as well as
// nine. The anchors are the positions of the tiles 0, 1, 2, 3 and 4 steps from the middle; in between, and beyond the
// last, the pose is interpolated or extended along the last step.
const ANCHORS = {
  tx: [0, 116, 231, 315, 399],
  ty: [0, 14, 42, 77, 112],
  rot: [0, 7, 14, 21, 28],
  sc: [1, 0.9346, 0.8498, 0.7756, 0.7014],
};

const along = (list, a) => {
  const i = Math.min(Math.floor(a), list.length - 2);
  return list[i] + (list[i + 1] - list[i]) * (a - i);
};

/** { tx, ty, rot, sc } for a tile `d` steps from the middle (negative = left of it). */
export function fanPose(d) {
  const a = Math.abs(d);
  const s = Math.sign(d);
  return { tx: s * along(ANCHORS.tx, a), ty: along(ANCHORS.ty, a), rot: s * along(ANCHORS.rot, a), sc: along(ANCHORS.sc, a) };
}
