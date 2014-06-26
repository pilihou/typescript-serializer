var io;
(function (io) {
    (function (xperiments) {
        (function (utils) {
            (function (serialize) {
                

                var SerializerDefinition = (function () {
                    function SerializerDefinition() {
                    }
                    return SerializerDefinition;
                })();
                serialize.SerializerDefinition = SerializerDefinition;
                var Serialized = (function () {
                    function Serialized() {
                    }
                    /**
                    *
                    * @returns {any}
                    */
                    Serialized.prototype.writeObject = function () {
                        return Serializer.writeObject(this);
                    };

                    /**
                    *
                    * @param obj
                    */
                    Serialized.prototype.readObject = function (obj) {
                        Serializer.readObject(this, obj);
                    };

                    /**
                    *
                    * @returns {any}
                    */
                    Serialized.prototype.stringify = function (pretty) {
                        if (typeof pretty === "undefined") { pretty = false; }
                        return JSON.stringify(Serializer.writeObject(this), null, pretty ? 4 : 0);
                    };

                    /**
                    *
                    * @returns {any}
                    */
                    Serialized.prototype.parse = function (string) {
                        Serializer.readObject(this, JSON.parse(string));
                    };
                    return Serialized;
                })();
                serialize.Serialized = Serialized;

                var Serializer = (function () {
                    function Serializer() {
                    }
                    /**
                    *
                    * @param classContext
                    * @param SerializerDataClass
                    */
                    Serializer.registerClass = function (classContext, SerializerDataClass) {
                        // determine class global path by parsing the body of the classContext Function
                        var classPath = /return ([A-Za-z0-9_$]*)/g.exec(classContext.toString())[1];

                        // Check if class has been processed
                        if (Serializer.serializableRegisters[classPath]) {
                            throw new Error('Class ' + classPath + ' already registered');
                        }

                        Serializer.getClassFromPath(classPath).prototype['@serializable'] = classPath;

                        Serializer.serializableRegisters[classPath] = {
                            keys: Serializer.getMixedNames(SerializerDataClass),
                            serializerData: SerializerDataClass
                        };
                    };

                    /**
                    *
                    * @param instance
                    * @returns {any}
                    */
                    Serializer.writeObject = function (instance) {
                        var obj = {};
                        var register = Serializer.getSerializableRegister(instance);
                        register.keys.filter(function (key) {
                            return key.indexOf('set_') != 0 && key.indexOf('get_') != 0;
                        }).forEach(function (key) {
                            var value = instance[key];
                            if (!value && !Serializer.isNumeric(value))
                                return;
                            Serializer.writeAny(obj, key, value, register.serializerData);
                        });
                        return obj;
                    };

                    /**
                    *
                    * @param instance
                    * @param obj
                    */
                    Serializer.readObject = function (instance, obj) {
                        var register = Serializer.getSerializableRegister(instance);
                        Serializer.getSerializableRegister(instance).keys.forEach(function (key) {
                            return Serializer.readAny(obj[key], key, instance, register.serializerData);
                        });
                    };

                    // Private Methods
                    /**
                    *
                    * @param array
                    * @returns {any[]}
                    */
                    Serializer.writeArray = function (array) {
                        var dummyObjectArray = { array: [] };
                        array.forEach(function (value, i) {
                            return Serializer.writeAny(dummyObjectArray.array, i, value, Serializer.getSerializableRegisterData(value));
                        });
                        return dummyObjectArray.array;
                    };

                    /**
                    *
                    * @param value
                    * @param key
                    * @param obj
                    * @param SerializerDataClass
                    */
                    Serializer.writeAny = function (obj, key, value, SerializerDataClass, fromArray) {
                        if (typeof SerializerDataClass === "undefined") { SerializerDataClass = null; }
                        if (typeof fromArray === "undefined") { fromArray = false; }
                        if (SerializerDataClass && typeof SerializerDataClass.prototype["set_" + key] == "function") {
                            obj[key] = SerializerDataClass.prototype["set_" + key](value);
                            return;
                        }

                        var elementType = typeof value;

                        switch (true) {
                            case elementType == "boolean":
                            case elementType == "string":
                            case elementType == "number":
                                obj[key] = value;
                                break;
                            case Array.isArray(value):
                                obj[key] = Serializer.writeArray(value);
                                break;
                            case elementType == "object" && !Array.isArray(value):
                                obj[key] = Serializer.isExternalizable(value) ? Serializer.writeObject(value) : JSON.parse(JSON.stringify(value));
                                break;
                        }
                    };

                    /**
                    *
                    * @param array
                    * @returns {any[]}
                    */
                    Serializer.readArray = function (array) {
                        var resultArray = [];

                        array.forEach(function (element, i) {
                            Serializer.readAny(element, i, resultArray, Serializer.getSerializableRegisterData(element));
                        });

                        //console.log('readArray array', resultArray );
                        return resultArray;
                    };

                    /**
                    *
                    * @param element
                    * @param key
                    * @param target
                    * @param SerializerDataClass
                    */
                    Serializer.readAny = function (element, key, target, SerializerDataClass) {
                        if (SerializerDataClass && typeof SerializerDataClass.prototype["get_" + key] == "function") {
                            target[key] = SerializerDataClass.prototype["get_" + key](element);
                            return;
                        }

                        var type = typeof element;
                        switch (true) {
                            case type == "boolean":
                            case type == "string":
                            case type == "number":
                                target[key] = element;
                                break;
                            case Array.isArray(element):
                                target[key] = Serializer.readArray(element);
                                break;
                            case type == "object" && !Array.isArray(element):
                                if (element.hasOwnProperty('@serializable')) {
                                    var moduleParts = element['@serializable'].split('.');
                                    var classPath = moduleParts.join('.');
                                    if (!target[key])
                                        target[key] = Serializer.getClass(classPath);
                                    target[key].readObject(element);
                                } else {
                                    target[key] = element;
                                }
                                break;
                        }
                    };

                    /* Helper Methods */
                    /**
                    *
                    * @param SerializerDataClass
                    * @returns {string[]}
                    */
                    Serializer.getMixedNames = function (SerializerDataClass) {
                        return Object.getOwnPropertyNames(new SerializerDataClass()).concat("@serializable");
                    };

                    /**
                    *
                    * @param instance
                    * @returns {boolean}
                    */
                    Serializer.isExternalizable = function (instance) {
                        return '@serializable' in instance && typeof instance.writeObject == "function" && typeof instance.readObject == "function";
                    };

                    /**
                    *
                    * @param name
                    * @param context
                    * @returns {any}
                    */
                    Serializer.getClassFromPath = function (name, context) {
                        if (typeof context === "undefined") { context = window; }
                        name.split('.').forEach(function (ctx) {
                            return context = context[ctx];
                        });
                        return context;
                    };

                    /**
                    *
                    * @param name
                    * @param context
                    * @returns {any}
                    */
                    Serializer.getClass = function (name, context) {
                        if (typeof context === "undefined") { context = window; }
                        name.split('.').forEach(function (ctx) {
                            return context = context[ctx];
                        });
                        return new context;
                    };

                    /**
                    *
                    * @param instance
                    * @returns {ISerializableRegister}
                    */
                    Serializer.getSerializableRegister = function (instance) {
                        var props = Serializer.serializableRegisters[instance['@serializable']] || null;
                        return props;
                    };

                    /**
                    *
                    * @param instance
                    * @returns {ISerializableRegister}
                    */
                    Serializer.getSerializableRegisterData = function (instance) {
                        var register = Serializer.getSerializableRegister(instance);
                        return register ? register.serializerData : null;
                    };

                    Serializer.isNumeric = function (n) {
                        return !isNaN(parseFloat(n)) && isFinite(n);
                    };
                    Serializer.serializableRegisters = {};
                    return Serializer;
                })();
                serialize.Serializer = Serializer;
            })(utils.serialize || (utils.serialize = {}));
            var serialize = utils.serialize;
        })(xperiments.utils || (xperiments.utils = {}));
        var utils = xperiments.utils;
    })(io.xperiments || (io.xperiments = {}));
    var xperiments = io.xperiments;
})(io || (io = {}));
/*
import ISerializableObject = io.xperiments.utils.serialize.ISerializableObject;
import Serializer = io.xperiments.utils.serialize.Serializer;
import Serialized = io.xperiments.utils.serialize.Serialized;
// the actual real class
class Data extends Serialized
{
"@serializable":string;
name:string;
address:string;
date:Date;
constructor()
{
super();
this.name = "foo";
this.address = "address";
this.date = new Date();
this.date.setMonth(1)
}
}
// here our values pattern to export
class DataSerializer implements ISerializableObject
{
"@serializable":string = null;
name:string = null;
date:string = null;
set_date(date:Date):string{return [ date.getFullYear(), date.getMonth()+1, date.getDate()].join('/')}
get_date(dateString:string):Date
{
var dateParts:string[] = dateString.split('/');
var date = new Date();
date.setFullYear( parseInt(dateParts[0],10));
date.setMonth( parseInt(dateParts[1],10)-1);
date.setDate( parseInt(dateParts[2],10));
return date;
}
}
Serializer.registerClass( ()=>Data, DataSerializer );
class ISubData implements ISerializableObject
{
"@serializable":string = null;
data:Data = null;
name:string = null;
date:string = null;
image:HTMLImageElement = null;
set_image( image:HTMLImageElement ):string
{
var canvas:HTMLCanvasElement = document.createElement('canvas');
canvas.width = image.width;
canvas.height = image.height;
canvas.getContext('2d').drawImage( image,0,0 );
return canvas.toDataURL();
}
get_image( image64:string ):HTMLImageElement
{
var img:HTMLImageElement = document.createElement('img');
img.src = image64;
return img;
}
set_date(date:Date):string{console.log('paso write');return [ date.getFullYear(), date.getMonth()+1, date.getDate()].join('/')}
get_date(dateString:string):Date
{
console.log('paso read');
var dateParts:string[] = dateString.split('/');
var date = new Date();
date.setFullYear( parseInt(dateParts[0],10));
date.setMonth( parseInt(dateParts[1],10)-1);
date.setDate( parseInt(dateParts[2],10));
return date;
}
}
// the actual real class
class SubData extends Serialized implements ISerializableObject
{
"@serializable":string;
data:Data;
name:string = "PEDRO";
date:Date = new Date();
image:HTMLImageElement;
constructor()
{
super();
this.data = new Data();
this.data.name = "SOME OTHER VALUE";
this.name = "JUAN";
this.data.address="SAMANIEGO 67";
this.image = document.createElement('img');
}
}
Serializer.registerClass( ()=>SubData, ISubData  );
var c = new SubData();
console.log( c.writeObject())
c.name="NEW VALUE";
c.image.src = "iphone-6-concept-Copiar.jpg";
setTimeout(()=>{
var d = new SubData();
d.readObject( c.writeObject() );
document.body.appendChild( d.image )
},5000);*/
//# sourceMappingURL=Serializer.js.map
