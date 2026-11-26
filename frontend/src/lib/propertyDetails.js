export const SUBTYPES = [
 ['ROOM','Phòng trọ','HOUSE'],['MINI_APARTMENT','Chung cư mini','APARTMENT'],
 ['HOMESTAY','Homestay','HOUSE'],['TOWNHOUSE','Nhà phố','HOUSE'],
 ['DETACHED_HOUSE','Nhà riêng','HOUSE'],['RESIDENTIAL_LAND','Đất ở (tự khai)','LAND'],
 ['AGRICULTURAL_LAND','Đất nông nghiệp (tự khai)','LAND'],['APARTMENT_UNIT','Căn hộ','APARTMENT'],
 ['VILLA','Biệt thự','VILLA'],['RETAIL','Mặt bằng kinh doanh','COMMERCIAL'],
 ['OFFICE','Văn phòng','COMMERCIAL'],['WAREHOUSE','Kho/xưởng','COMMERCIAL']
];
export const FURNISHINGS=[['NONE','Không nội thất'],['BASIC','Nội thất cơ bản'],['FULL','Đầy đủ nội thất']];
export const DIRECTIONS=[['N','Bắc'],['NE','Đông Bắc'],['E','Đông'],['SE','Đông Nam'],['S','Nam'],['SW','Tây Nam'],['W','Tây'],['NW','Tây Bắc']];
export const LEGAL_CLAIMS=[['CERTIFICATE_REPORTED','Người đăng khai có giấy chứng nhận'],['PENDING_REPORTED','Người đăng khai đang làm thủ tục'],['OTHER_REPORTED','Thông tin pháp lý khác (tự khai)']];
export const AMENITIES=[['hasAirConditioner','Điều hòa'],['hasWaterHeater','Nóng lạnh'],['hasPrivateBathroom','Vệ sinh riêng'],['hasLoft','Gác xép'],['hasBalcony','Ban công'],['hasParking','Chỗ gửi xe'],['allowsPets','Cho nuôi thú cưng']];
export function detailRows(details={}){
 const lookup=(items,key)=>items.find(x=>x[0]===key)?.[1];
 return [
 ['Loại chi tiết',lookup(SUBTYPES,details.subtype)],['Số tầng',details.floors],
 ['Phòng ngủ',details.bedrooms],['Phòng vệ sinh',details.bathrooms],
 ['Mặt tiền',details.frontageM==null?null:details.frontageM+' m'],
 ['Đường vào',details.accessWidthM==null?null:details.accessWidthM+' m'],
 ['Hướng',lookup(DIRECTIONS,details.direction)],['Nội thất',lookup(FURNISHINGS,details.furnishing)],
 ['Số người ở tối đa',details.maxOccupants],['Pháp lý (chưa xác minh)',lookup(LEGAL_CLAIMS,details.legalClaim)]
 ].filter(([,value])=>value!==undefined&&value!==null&&value!=='');
}
export function submissionDetails(form){
 const source=form.details||{}, result={};
 const isLand=form.propertyType==='LAND';
 if(SUBTYPES.some(([key,,parent])=>key===source.subtype&&parent===form.propertyType))result.subtype=source.subtype;
 for(const key of ['direction','legalClaim'])if(source[key])result[key]=source[key];
 for(const key of ['frontageM','accessWidthM'])if(source[key]!=null&&source[key]!=='')result[key]=Number(source[key]);
 if(!isLand){
  for(const key of ['floors','bedrooms','bathrooms'])if(source[key]!=null&&source[key]!=='')result[key]=Number(source[key]);
  if(source.furnishing)result.furnishing=source.furnishing;
  if(form.transactionType==='RENT'&&source.maxOccupants!=null&&source.maxOccupants!=='')result.maxOccupants=Number(source.maxOccupants);
 }
 return result;
}
