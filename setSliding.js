

// let {getIsSlideRunning,setIsSlideRunning} =require('./utils')
let axios = require('axios')
let init = async () => {
  let res = await axios('http://localhost:4000/getIsSlideRunning')
  console.log(res)
  await axios('http://localhost:4000/setIsSlideRunning',{
    data:{
        isSliding: false
    }
  })
  // let res = await getMobileActivityInfo("746552023427");
//   console.log(1,res);
//   setTimeout(async () => {

//   }, 2000);
};
init();
