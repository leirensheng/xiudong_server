let axios = require('axios')
axios({
  method:'post',
  url:'http://localhost:4000/sendAppMsg',
  data:{
    title:'test',
    content:'ste',
    payload:{
      type:'info'
    }
  }
})