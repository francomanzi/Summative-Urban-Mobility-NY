//Merge sort algo to sort the zones based on their rank
function mergeTwoLists(left, right) {
  const result = [];
  let i = 0;
  let j = 0;

  while (i < left.length && j < right.length) {
    if (left[i].trips >= right[j].trips) {
      result.push(left[i]);
      i++;
    } else {
      result.push(right[j]);
      j++;
    }
  }
  while (i < left.length) { result.push(left[i]); i++; }
  while (j < right.length) { result.push(right[j]); j++; }
  return result;
}

function mergeSort(list){
    if (list.length <= 1) return list;
    const middle = Math.floor(list.length / 2);
    const left = mergeSort(list.slice(0, middle));
    const right = mergeSort(list.slice(middle));
    return mergeTwoLists(left, right);
}

export function rankZones(zones, howMany) {
  return mergeSort(zones).slice(0, howMany);
}
