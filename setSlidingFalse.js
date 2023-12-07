let axios = require('axios')
axios({
    url:'http://localhost:4000/setIsSlideRunning',
    method:'post',
    data:{
        isSliding: false
    }
}).then(res=>{
    console.log(res.data)
})