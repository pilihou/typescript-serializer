module io.xperiments.utils.serialize
{

	export interface ISerializableObject
	{
		"@serializable":string;
	}

	export interface ISerializerDefinition
	{
		"@serializer":string;
	}

	export interface ISerializable
	{
		writeObject( root:boolean ):any;
		readObject( obj:any ):void;
		stringify():string;
		parse( string:string ):void;

	}

	export interface ISerializableRegister
	{
		keys:string[];
		serializerData:typeof SerializerDefinition;
	}

	export interface ISerializableRegisters
	{
		[key:string]:ISerializableRegister;
	}

	export class SerializerDefinition implements ISerializerDefinition
	{
		"@serializer":string;
	}

	export class Serialized implements ISerializable
	{
		/**
		 *
		 * @returns {any}
		 */
		public writeObject():ISerializableObject
		{

			return Serializer.writeObject( this );
		}
		/**
		 *
		 * @param obj
		 */
		public readObject(obj:ISerializableObject):void
		{
			Serializer.readObject(this, obj);
		}

		/**
		 *
		 * @returns {any}
		 */
		public stringify( pretty:boolean = false ):string
		{
			return JSON.stringify( Serializer.writeObject( this ), null, pretty? 4:0 );
		}
		/**
		 *
		 * @returns {any}
		 */
		public parse( string:string ):void
		{
			Serializer.readObject(this, JSON.parse( string ));
		}

	}

	export class Serializer
	{
		private static serializableRegisters:ISerializableRegisters = {};

		/**
		 *
		 * @param classContext
		 * @param SerializerDataClass
		 */
		public static registerClass( classContext:()=>any, SerializerDataClass:typeof SerializerDefinition ):void
		{

			// determine class global path by parsing the body of the classContext Function
			var classPath:string = /return ([A-Za-z0-9_$]*)/g.exec(classContext.toString())[1];

			// Check if class has been processed
			if( Serializer.serializableRegisters[ classPath ] )
			{
				throw new Error('Class '+classPath+' already registered');
			}

			Serializer.getClassFromPath( classPath ).prototype['@serializable'] = classPath;

			Serializer.serializableRegisters[classPath] =
			{
				keys:Serializer.getMixedNames( SerializerDataClass ),
				serializerData:SerializerDataClass
			};
		}

		/**
		 *
		 * @param instance
		 * @returns {any}
		 */
		public static writeObject( instance:ISerializable ):any
		{
			var obj:any = {};
			var register:ISerializableRegister = Serializer.getSerializableRegister( instance );
			register.keys.filter((key)=>{ return key.indexOf('set_')!=0 &&  key.indexOf('get_')!=0 }).forEach(( key:string )=>
			{
				var value:any = instance[key];
				if( !value && !Serializer.isNumeric( value )) return; // don't getSerializableProperties void/empty/undefined
				Serializer.writeAny( obj, key, value, register.serializerData );
			});
			return obj;
		}

		/**
		 *
		 * @param instance
		 * @param obj
		 */
		public static readObject( instance:ISerializable, obj:any ):void
		{
			var register:ISerializableRegister = Serializer.getSerializableRegister( instance );
			Serializer.getSerializableRegister( instance ).keys
				.forEach( ( key:string )=> Serializer.readAny( obj[key], key, instance, register.serializerData ) );
		}



		// Private Methods
		/**
		 *
		 * @param array
		 * @returns {any[]}
		 */
		private static writeArray( array:any[] ):any[]
		{
			var dummyObjectArray:{array:any[]} = { array:[] };
			array.forEach( ( value , i )=> Serializer.writeAny( dummyObjectArray.array, i, value , Serializer.getSerializableRegisterData( value )  ) );
			return dummyObjectArray.array;
		}

		/**
		 *
		 * @param value
		 * @param key
		 * @param obj
		 * @param SerializerDataClass
		 */
		private static writeAny( obj:any,key:any,value:any, SerializerDataClass:any = null , fromArray:boolean = false )
		{

			if( SerializerDataClass && typeof SerializerDataClass.prototype["set_"+key] == "function" )
			{
				obj[key] = SerializerDataClass.prototype["set_"+key]( value );
				return;
			}

			var elementType = typeof value;

			switch( true )
			{
				case elementType=="boolean":
				case elementType=="string":
				case elementType=="number":
					obj[key] = value;
					break;
				case Array.isArray( value ):
					obj[key] = Serializer.writeArray( value );
					break;
				case elementType=="object" && !Array.isArray( value ):
					obj[key] = Serializer.isExternalizable( value ) ? Serializer.writeObject( value ):JSON.parse(JSON.stringify( value ));
					break;
			}

		}

		/**
		 *
		 * @param array
		 * @returns {any[]}
		 */
		private static readArray( array:any[] ):any[]
		{
			var resultArray:any[] = [];

			array.forEach( ( element, i )=>{
				Serializer.readAny( element, i, resultArray, Serializer.getSerializableRegisterData( element ) );
			});
			//console.log('readArray array', resultArray );
			return resultArray;
		}

		/**
		 *
		 * @param element
		 * @param key
		 * @param target
		 * @param SerializerDataClass
		 */
		private static readAny( element:any, key:any, target:any, SerializerDataClass:any )
		{

			if( SerializerDataClass && typeof SerializerDataClass.prototype["get_"+key] == "function" )
			{
				target[key] = SerializerDataClass.prototype["get_"+key]( element );
				return;
			}

			var type:string = typeof element;
			switch( true )
			{
				case type=="boolean":
				case type=="string":
				case type=="number":
					target[key] = element;
					break;
				case Array.isArray( element ):
					target[key] = Serializer.readArray( element );
					break;
				case type=="object" && !Array.isArray( element ):
					if( element.hasOwnProperty('@serializable') )
					{
						var moduleParts:string[] = element['@serializable'].split('.');
						var classPath:string = moduleParts.join('.');
						if( !target[key] ) target[key] = Serializer.getClass(classPath);
						target[key].readObject( element );
			 		}
					else
					{
						target[key] = element;
					}
					break;
			}

		}

		/* Helper Methods */

		/**
		 *
		 * @param SerializerDataClass
		 * @returns {string[]}
		 */
		private static getMixedNames( SerializerDataClass:any ):string[]
		{
			return Object.getOwnPropertyNames( new SerializerDataClass() ).concat("@serializable");
		}


		/**
		 *
		 * @param instance
		 * @returns {boolean}
		 */
		private static isExternalizable( instance ):boolean
		{
			return '@serializable' in instance && typeof instance.writeObject == "function" && typeof instance.readObject == "function";
		}

		/**
		 *
		 * @param name
		 * @param context
		 * @returns {any}
		 */
		private static getClassFromPath( name:string , context:any = window ):any
		{
			name.split('.').forEach( ctx=>context = context[ ctx ] );
			return context;
		}

		/**
		 *
		 * @param name
		 * @param context
		 * @returns {any}
		 */
		private static getClass( name:string , context:any = window ):any
		{
			name.split('.').forEach( ctx=>context = context[ ctx ] );
			return new context;
		}

		/**
		 *
		 * @param instance
		 * @returns {ISerializableRegister}
		 */
		private static getSerializableRegister( instance:ISerializable ):ISerializableRegister
		{
			var props:ISerializableRegister = Serializer.serializableRegisters[ instance['@serializable'] ] || null;
			return props;
		}

		/**
		 *
		 * @param instance
		 * @returns {ISerializableRegister}
		 */
		private static getSerializableRegisterData( instance:ISerializable ):typeof SerializerDefinition
		{

			var register = Serializer.getSerializableRegister( instance );
			return register ? register.serializerData:null;
		}

		private static isNumeric(n:any):boolean
		{
			return !isNaN(parseFloat(n)) && isFinite(n);
		}
	}
}



