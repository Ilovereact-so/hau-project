'server-only'

import NavPMenu from "./NavPMenu"
import ServerUser from "./ServerUser"

const ProductsNavbar = async () => {

  return (
    <div className="">
        <NavPMenu>
            <ServerUser mode={1}/>
        </NavPMenu>
    </div>
  )
}



export default ProductsNavbar